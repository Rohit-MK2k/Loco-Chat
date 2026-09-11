# LocoChat — Current Architecture Sequence Diagrams

This document illustrates the execution and data flow across LocoChat's layers in its current implementation.

---

## 1. System Layer Overview

LocoChat's current core engine operates across four primary boundaries:

1. **Consumer / Entry Layer:** The caller initiating operations (currently tests/services, future Electron IPC bridge).
2. **Session & Selection Layer:** [`Session`](../src/core/ai/session/session.ts), [`ProviderSelection`](../src/core/ai/providers/states/providerSelection.ts), and [`connectedProviders`](../src/core/ai/providers/states/connectedProviders.ts).
3. **Provider Abstraction Layer:** [`BasePiAiProvider`](../src/core/ai/providers/BasePiAiProvider.ts), [`classifyProviderError`](../src/core/ai/providers/errors.ts), and concrete implementations ([`GeminiProvider`](../src/core/ai/providers/gemini.ts), [`OpenrouterProvider`](../src/core/ai/providers/openrouter.ts)).
4. **Persistence Layer:** [`JsonProviderAuthStorage`](../src/core/ai/providers/repo/storage/jsonAuthStorage.ts) and [`JsonSessionStore`](../src/core/ai/session/repo/storage/jsonSessionStore.ts).

---

## 2. Flow 1: Provider Initialization & Key Validation

This flow demonstrates how credentials stored on disk are verified against external vendor APIs and loaded into active memory.

```mermaid
sequenceDiagram
    autonumber
    actor Consumer as "Consumer / App Startup"
    participant AuthStorage as "JsonProviderAuthStorage"
    participant Connected as "connectedProviders"
    participant Registry as "Provider Registry"
    participant Provider as "Concrete Provider<br/>(Gemini / OpenRouter)"
    participant RemoteAPI as "Vendor Auth Endpoint"

    Consumer->>Connected: initActiveProvider(authStorage)
    activate Connected
    Connected->>AuthStorage: loadAll()
    activate AuthStorage
    AuthStorage-->>Connected: ProviderAuthConfigData[]
    deactivate AuthStorage

    loop For each stored provider key
        Connected->>Registry: getProvider(providerId, apiKey)
        activate Registry
        Registry->>Provider: new GeminiProvider(apiKey) / new OpenrouterProvider(apiKey)
        Registry-->>Connected: provider instance
        deactivate Registry

        Connected->>Provider: validateApiKey()
        activate Provider
        Provider->>RemoteAPI: HTTP GET (validate key / list models)
        activate RemoteAPI
        RemoteAPI-->>Provider: HTTP 200 OK
        deactivate RemoteAPI
        Provider-->>Connected: true
        deactivate Provider

        Connected->>Connected: activeProviders.set(providerId, provider)
    end

    Connected-->>Consumer: boolean (initialized successfully)
    deactivate Connected
```

---

## 3. Flow 2: Conversation Turn, Hybrid Streaming & Persistence

This flow depicts what happens when a user sends a message. The token stream emits deltas to the caller in real-time, while the full response is awaited and saved atomically to disk.

```mermaid
sequenceDiagram
    autonumber
    actor Consumer as "Consumer / UI"
    participant Session as "Session"
    participant Selection as "ProviderSelection"
    participant BaseProvider as "BasePiAiProvider"
    participant PiAI as "@earendil-works/pi-ai<br/>modelsCollection.stream()"
    participant VendorAPI as "Remote LLM Service"
    participant SessionStore as "JsonSessionStore"

    Consumer->>Session: sendMessage("Hello", onChunk)
    activate Session
    Session->>Session: append AppMessage(role: "user", content, timestamp)

    Session->>Selection: getSelection()
    activate Selection
    Selection-->>Session: { provider, model }
    deactivate Selection

    Session->>BaseProvider: generateReply(messages, model, onChunk)
    activate BaseProvider
    BaseProvider->>BaseProvider: format AppMessage[] into pi-ai Context

    BaseProvider->>PiAI: modelsCollection.stream(modelRef, context)
    activate PiAI
    PiAI->>VendorAPI: POST /stream completion
    activate VendorAPI

    loop Token Streaming (Delta Events)
        VendorAPI-->>PiAI: Stream chunk (delta)
        PiAI-->>BaseProvider: event: text_delta
        BaseProvider->>Consumer: onChunk(delta)
    end

    VendorAPI-->>PiAI: Stream complete (terminal)
    deactivate VendorAPI
    PiAI-->>BaseProvider: stream.result()
    deactivate PiAI
    BaseProvider-->>Session: fullReplyText
    deactivate BaseProvider

    Session->>Session: append AppMessage(role: "assistant", fullReplyText, timestamp)
    Session->>Session: update lastUsedAt: Date.now()

    Session->>SessionStore: save(this.serialize())
    activate SessionStore
    SessionStore->>SessionStore: fs.writeFile(<sessionId>.json)
    SessionStore-->>Session: void
    deactivate SessionStore

    Session-->>Consumer: fullReplyText
    deactivate Session
```

---

## 4. Flow 3: Error Classification & Model Deprecation Handling

When an upstream vendor rejects a model (for instance, sunsetting Gemini 1.5 or missing routing), [`classifyProviderError`](../src/core/ai/providers/errors.ts) intercepts the failure and transforms it into a typed [`ModelUnavailableError`](../src/core/ai/providers/errors.ts).

```mermaid
sequenceDiagram
    autonumber
    actor Consumer as "Consumer / UI"
    participant Session as "Session"
    participant BaseProvider as "BasePiAiProvider"
    participant PiAI as "pi-ai / Vendor API"
    participant Classifier as "classifyProviderError()"

    Consumer->>Session: sendMessage("Prompt", onChunk)
    activate Session
    Session->>BaseProvider: generateReply(messages, model, onChunk)
    activate BaseProvider

    BaseProvider->>PiAI: modelsCollection.stream(model, context)
    activate PiAI
    PiAI-->>BaseProvider: throws Error("models/gemini-1.5-pro is discontinued. Use gemini-2.5-pro")
    deactivate PiAI

    BaseProvider->>Classifier: classifyProviderError("google", model, err.message)
    activate Classifier
    Classifier->>Classifier: Match regex against known sunset patterns
    Classifier-->>BaseProvider: ModelUnavailableError(providerId, modelId, suggestedModel: "gemini-2.5-pro")
    deactivate Classifier

    BaseProvider-->>Session: throws ModelUnavailableError
    deactivate BaseProvider

    Session-->>Consumer: throws ModelUnavailableError
    deactivate Session

    Note over Consumer: Consumer catches ModelUnavailableError<br/>and suggests replacement model to user
```

---

## 5. Flow 4: RAG Pipeline (Ingestion & Context-Augmented Generation)

When uploaded documents exceed the inline context window, the application executes a two-phase RAG pipeline: offline/upload-time ingestion and query-time retrieval.

```mermaid
sequenceDiagram
    autonumber
    actor Consumer as "Consumer / UI"
    participant Session as "Session"
    participant RAG as "RAGPipeline"
    participant Embedder as "EmbeddingService"
    participant VectorStore as "VectorStore"
    participant Provider as "BasePiAiProvider"
    participant LLM as "Remote LLM Service"

    Note over Consumer,VectorStore: 1. Ingestion Phase (Document Upload)
    Consumer->>RAG: ingestDocument(filePath)
    activate RAG
    RAG->>RAG: parse & chunk text (semantic overlap)
    RAG->>Embedder: embedChunks(textChunks[])
    activate Embedder
    Embedder-->>RAG: embeddings[]
    deactivate Embedder
    RAG->>VectorStore: store(chunks, embeddings, metadata)
    activate VectorStore
    VectorStore-->>RAG: documentId
    deactivate VectorStore
    RAG-->>Consumer: ingestionComplete(documentId)
    deactivate RAG

    Note over Consumer,LLM: 2. Query Phase (Retrieval & Augmented Prompt)
    Consumer->>Session: sendMessage(prompt, onChunk)
    activate Session
    Session->>RAG: retrieveContext(prompt, topK)
    activate RAG
    RAG->>Embedder: embedQuery(prompt)
    activate Embedder
    Embedder-->>RAG: queryVector
    deactivate Embedder
    RAG->>VectorStore: similaritySearch(queryVector, topK)
    activate VectorStore
    VectorStore-->>RAG: topKRelevantChunks[]
    deactivate VectorStore
    RAG-->>Session: augmentedPrompt(context + prompt)
    deactivate RAG

    Session->>Provider: generateReply(messagesWithContext, model, onChunk)
    activate Provider
    Provider->>LLM: stream(messagesWithContext)
    activate LLM

    loop Streaming Response Tokens
        LLM-->>Provider: stream token delta
        Provider-->>Consumer: onChunk(delta)
    end

    LLM-->>Provider: stream complete
    deactivate LLM
    Provider-->>Session: fullReplyText
    deactivate Provider
    Session-->>Consumer: fullReplyText
    deactivate Session
```

---

## 6. Flow 5: Tool Execution Loop (Local TOOL A & MCP TOOL B)

Illustrates the tool execution loop. The core handles both native local tools (`TOOL A`) and remote Model Context Protocol tools (`TOOL B`) through the same unified loop.

```mermaid
sequenceDiagram
    autonumber
    actor Consumer as "Consumer / UI"
    participant Session as "Session"
    participant Provider as "BasePiAiProvider"
    participant LLM as "Remote LLM Service"
    participant ToolExecutor as "ToolRegistry / ExecutionLoop"
    participant ToolA as "TOOL A (Local Tool)"
    participant MCPClient as "MCPClient"
    participant MCPServer as "External MCP Server<br/>(Hosts TOOL B)"
    participant SessionStore as "JsonSessionStore"

    Consumer->>Session: sendMessage("User prompt", onChunk)
    activate Session
    Session->>Provider: generateReply(messages, model, tools: [TOOL A, TOOL B], onChunk)
    activate Provider

    Provider->>LLM: stream(messages, tools: [TOOL A, TOOL B])
    activate LLM
    LLM-->>Provider: tool_call event: TOOL A(args)
    deactivate LLM
    Provider-->>Session: emit tool_call: TOOL A(args)

    Note over Session,ToolA: Local Tool Execution (TOOL A)
    Session->>ToolExecutor: executeTool("TOOL A", args)
    activate ToolExecutor
    ToolExecutor->>ToolA: run(args)
    activate ToolA
    ToolA-->>ToolExecutor: resultA
    deactivate ToolA
    ToolExecutor-->>Session: resultA
    deactivate ToolExecutor

    Session->>Provider: submitToolResult(callId_A, resultA)
    activate Provider
    Provider->>LLM: stream(messages + tool_call_A + resultA)
    activate LLM
    LLM-->>Provider: tool_call event: TOOL B(args)
    deactivate LLM
    Provider-->>Session: emit tool_call: TOOL B(args)

    Note over Session,MCPServer: MCP External Connector Execution (TOOL B)
    Session->>ToolExecutor: executeTool("TOOL B", args)
    activate ToolExecutor
    ToolExecutor->>MCPClient: callTool("TOOL B", args)
    activate MCPClient
    MCPClient->>MCPServer: JSON-RPC tools/call (TOOL B, args)
    activate MCPServer
    MCPServer-->>MCPClient: resultB
    deactivate MCPServer
    MCPClient-->>ToolExecutor: resultB
    deactivate MCPClient
    ToolExecutor-->>Session: resultB
    deactivate ToolExecutor

    Session->>Provider: submitToolResult(callId_B, resultB)
    activate Provider
    Provider->>LLM: stream(messages + allToolTurns)
    activate LLM

    loop Stream Final Assistant Response
        LLM-->>Provider: stream token delta
        Provider-->>Consumer: onChunk(delta)
    end

    LLM-->>Provider: terminal reply complete
    deactivate LLM
    Provider-->>Session: finalReplyText
    deactivate Provider

    Session->>SessionStore: save(all turns: user, tool calls, tool results, final reply)
    Session-->>Consumer: finalReplyText
    deactivate Session
```

---

## 7. Flow 6: File & Photo Upload (Direct Inlining vs RAG)

This flow illustrates the file upload process, highlighting the core/skin separation. The React renderer requests a file, the Electron main process reads it from the filesystem, and the Core evaluates context constraints to decide between direct inlining or RAG ingestion.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant ReactUI as "Renderer (React UI)"
    participant MainIPC as "Main Process (Electron IPC)"
    participant FileSystem as "Local File System"
    participant Core as "Core Application Logic"
    participant RAG as "RAG Pipeline"

    User->>ReactUI: Clicks "Upload File"
    activate ReactUI
    ReactUI->>MainIPC: requestFilePicker()
    activate MainIPC
    
    MainIPC->>User: Native OS File Dialog
    User-->>MainIPC: Selects file
    
    MainIPC->>FileSystem: fs.readFile(path)
    activate FileSystem
    FileSystem-->>MainIPC: fileBuffer
    deactivate FileSystem

    MainIPC->>Core: handleUpload(fileBuffer, metadata)
    activate Core
    Core->>Core: measure token count / size
    
    alt Fits in Context Window
        Core->>Core: Encode as content block (base64 image, text, or pdf)
        Core-->>MainIPC: inlineAttachment
        MainIPC-->>ReactUI: update UI (file attached inline)
        Note over ReactUI,Core: User sends message -> attachment passed to sendMessage()
    else Exceeds Context & Embeddings Configured
        Core->>RAG: ingestDocument(fileBuffer)
        activate RAG
        Note right of RAG: Executes Ingestion Phase<br/>(See Flow 4)
        RAG-->>Core: documentId
        deactivate RAG
        Core-->>MainIPC: ragAttachment(documentId)
        MainIPC-->>ReactUI: update UI (document added to RAG context)
    else Exceeds Context & No Embeddings Configured
        Core-->>MainIPC: throws Error("File too large. Configure embedding model.")
        MainIPC-->>ReactUI: Error message
        ReactUI-->>User: Display explicit rejection message (No silent truncation)
    end
    deactivate Core
    deactivate MainIPC
    deactivate ReactUI
```
