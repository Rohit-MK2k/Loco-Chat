# Local-First AI Chat Application — Project Documentation

**Status:** Architecture defined; core provider-communication primitive implemented as a standalone script
**Origin:** CodeX (an earlier RAG/knowledge-graph tool for codebase understanding) was fully discontinued before real implementation began, due to graph-pipeline complexity. This project is a fresh start — no shared code, though lessons learned (see below) carry over.
**Purpose:** Beyond being a useful local tool, this project is deliberately structured as a hands-on vehicle for learning **Agentic AI, RAG, coding agents, harness engineering, and context engineering** by implementing them for real, rather than studying them abstractly.

---

## 1. Project Overview

A local-first desktop chat application — conceptually similar to Claude Desktop or the ChatGPT desktop client — but running **entirely on the user's machine**, with no authentication, no hosting, and no browser dependency.

### Why local desktop, not a web app

Several planned features (file access, coding agent integration) require direct filesystem access that browser sandboxing does not allow. A locally running desktop application removes that restriction entirely, at the cost of giving up "just open a URL" convenience — an acceptable tradeoff given the feature set.

---

## 2. Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| Desktop shell | **Electron** | Cross-platform (Windows, macOS, Linux) from one codebase; native TypeScript support; large ecosystem |
| Mobile Shell (in Future) | React Native | Cross-platform (For Android and IOS) |
| Provider Layer | pi-al module (@earendil-works/pi-ai) | No need to write the core provider logic "pi-ai" handles for you. |
| Language | **TypeScript** (throughout — main process, renderer, and core logic) | Type safety, consistency across the whole app |
| Frontend framework | **React** (in Electron's renderer process) | Chosen for the UI layer |
| Storage | Local File Storage | Storage the data in the `~/User/{user_name}/.locochat` |
| Coding agent | **Pi** (`@earendil-works/pi-coding-agent`) | Node.js/TS SDK, embeds directly into the core — no subprocess shelling required |

### Electron: two-process model (important context)

Electron apps are split into two separate runtime environments:

- **Main process** — full Node.js access, including the filesystem. No DOM.
- **Renderer process** — Chromium (the UI, built in React). No direct filesystem/Node access for security reasons.

The two communicate via **IPC (Inter-Process Communication)**. Any feature involving file access (file uploads, Pi's file operations, etc.) must originate from or pass through the main process.

---

## 3. Core Architectural Principle: Core/Skin Separation

All real application logic — providers, memory, projects, tools, Pi integration — lives in **plain Node.js/TypeScript with zero Electron-specific code**. Electron is treated as a thin **UI skin** that calls into this core.

**Why this matters:**
- The core has no knowledge of Electron, the DOM, or IPC.
- Electron's IPC handlers are thin — they call core functions and pass results back to React, nothing more.
- If a different front-end is ever wanted in the future, it becomes a new consumer of the same core, not a rewrite of the application's logic.

**Anti-pattern to avoid:** writing business logic directly inside Electron IPC handlers or React components. That couples logic to the UI layer and makes it difficult to reuse, test, or replace later.

---

## 4. Feature Breakdown

### 4.1 No Authentication / No Hosting

Since the app runs entirely locally and is single-user by nature, there is no login system, no account management, and no server component to host. All data lives on the user's machine.

### 4.2 Multi-Provider AI Support

The chat core is designed to support multiple AI backends (e.g., Claude API, and others added later) behind a common interface, rather than being hard-coded to one provider.

Each provider's SDK has its own request/response shape (message format, field names, streaming behavior), and these shapes can differ significantly between vendors — and change over time within the same vendor. The application maintains its own internal, provider-agnostic conversation representation; translating to and from each provider's specific wire format happens at the boundary (inside that provider's module), never inside shared chat logic. Chat logic depends only on the common interface, never on a specific provider's SDK types directly.


### 4.3 Conversation History

Standard persisted chat history: conversations are stored, retrievable, and organized (globally, or nested under a project). Backed by SQLite.

Conversation state is owned and persisted locally by the application, not by an AI provider. Some provider APIs offer their own server-side conversation/session storage as a convenience — this is intentionally not used, since relying on it would mean conversation data lives outside the user's machine, conflicting with the local-first principle. The application always sends the relevant conversation history itself on each request, built from its own local record.

### 4.4 File & Photo Upload

Upload is **not** a retrieval/RAG feature — it is a direct-inlining feature. The entire file's content is sent to the model as part of the message, the same as if it were pasted into the chat box.

**Flow:**
1. User picks a file in the React UI.
2. The renderer requests a native file picker via IPC — the actual file-system read happens in Electron's **main process** (the renderer cannot access the filesystem directly).
3. The main process reads the file:
   - Images → base64-encoded, sent as an `image` content block.
   - PDFs → sent as a `document` content block.
   - Plain text/code → read and inlined directly into the prompt text.
4. The result is handed to the same "send message" function used for normal chat — upload is just a different way of producing input, not a separate pipeline.

**Handling large files (the RAG path):**

Uploads that don't fit inline (e.g. a 400-page PDF, or "chat with my whole document library") require retrieval instead of direct inlining. RAG is treated as **opt-in infrastructure**, not default behavior, since it adds real cost (embedding calls, storage, latency) that isn't justified for content that already fits in context.

Decision logic at upload time:

1. **Measure the actual constraint** — token count for text (not file size or page count, since those don't reliably predict token count), or count/size for images.
2. **If it fits inline** → always just inline it directly, regardless of whether an embedding model is configured. Inlining the full content is strictly better than retrieval when there's no size constraint forcing a choice.
3. **If it doesn't fit:**
   - **Embedding model configured** → run the RAG ingestion pipeline: chunk → embed → store in a vector table (SQLite-backed at this scale, no dedicated vector DB needed yet) → retrieve top-K relevant chunks per query → inject those into the prompt.
   - **No embedding model configured** → **reject the upload with a clear message** telling the user to configure an embedding provider. Never silently truncate — silent truncation looks like it worked while quietly discarding most of the document, which is worse than an explicit rejection.

**Images at scale:** a single image is simply inlined (base64), same as any small file — no embedding needed. Retrieval only becomes relevant for **collections** of images (e.g. "find the photo where I'm at the beach"), which uses an image embedding model (e.g. CLIP) so images and text queries land in the same vector space. Same decision logic applies: only invoked when there's an actual search-across-many-images need, and only if a CLIP-like model is configured.

**Chunking quality note (carried over from CodeX):** naive fixed-size chunking loses context — a chunk boundary can cut a function, idea, or sentence in half. This was a real failure mode in CodeX's RAG-based prototype (before it pivoted to the graph approach). When the RAG pipeline is built here, prefer semantic or structure-aware chunking (by heading/section, with overlap between chunks) over arbitrary fixed-size splits.

### 4.5 Projects

Each project has:
- **Project instructions** — custom guidance/context applied to all conversations within that project (similar to Claude Projects / GPTs custom instructions).
- **Project memory** — memory entries scoped to that specific project only (see Unified Memory below for how this interacts with global memory).

### 4.6 Unified Memory

Two tiers of memory, distinguished by scope:

- **Global memory** — persistent memory accessible from *any* conversation, project's memory not included (equivalent to ChatGPT's or Claude's global memory feature).
- **Project memory** — accessible only within that project's conversations, *in addition to* global memory.

**Mechanical model:** memory entries are rows with a nullable `project_id` field:
- `project_id = NULL` → global memory, visible everywhere.
- `project_id = <id>` → scoped to that project, visible only within it (plus global memory is still visible).

This is intentionally simple — a single nullable foreign key — rather than a separate memory system per scope.

### 4.7 Skills & External Connectors

- **Connectors**: will use the **MCP (Model Context Protocol)** standard — an existing, known specification rather than a custom one.
- **Skills**: architecture not yet decided. Parked for future design once the core chat loop is working.

### 4.8 Tool Support

The application supports tool use — the AI can invoke defined tools/functions as part of a conversation, not just return plain text. This is the same general mechanism that powers the web search feature and Pi's file/command tools (see below).

### 4.9 Pi Coding Agent Integration

Modeled after how Claude Code integrates into Claude Desktop: the chat application can invoke a coding agent capable of reading/writing files and running commands, not just generating text.

**Key implementation detail:** Pi is distributed as an **npm package** (`@earendil-works/pi-coding-agent`) with a proper SDK — it is *not* a CLI you shell out to. This means:
- It installs directly into the same Node/TypeScript project as the rest of the core.
- It runs in-process (no subprocess management needed for the basic case; an RPC/isolated mode exists if ever needed).
- Architecturally, it slots into the core as **a provider-like module** — conceptually similar to a normal AI provider, except its responses are a *stream of events* (text output, tool calls, file edits) rather than a single text reply.

**Basic usage shape:**
```
const session = createAgentSession();
session.subscribe(event => { /* handle streamed text / tool actions */ });
session.prompt("do X");
```

### 4.10 Web Search

Built **natively**, rather than relying on a provider's built-in search tool (e.g. Claude's or OpenAI's own hosted web search). This is a deliberate choice: a provider's built-in tool is a black box — you flip a switch and it works, but you learn nothing about *how* search actually integrates into an agent's reasoning loop. Since this project exists partly to learn agentic AI and context engineering, building it yourself is the better rep, even though it's more work upfront.

**How it works — the tool-calling loop:**
1. The model is given a tool definition (e.g. `search(query: string)`) as part of the request, the same general mechanism used for Pi and MCP connectors.
2. When the model decides it needs current information, it emits a tool-call request instead of a final answer.
3. The core catches that request and calls a real external search API (e.g. Brave Search, Tavily, SerpAPI, or Bing/Google's search APIs) — provider-agnostic, not tied to any one AI vendor.
4. The core decides how to handle the raw results — dump snippets into context as-is, or fetch and summarize the top few full pages. This is a genuine context-engineering decision to make deliberately, not one hidden by a provider's black box.
5. The result is sent back to the model as a tool result, and the model continues the conversation with that information incorporated.

This same tool-calling loop (model → tool call → core executes → result fed back) is the pattern reused across web search, Pi, and MCP connectors — building it once here, from scratch, is meant to make that pattern legible rather than assumed.

**Planned evolution:** a future **deep research** feature, layered on top of this once basic web search is working — likely involving multiple search/fetch rounds and synthesis across sources, rather than a single search call.

---

## 5. Decisions Made So Far

- Electron + TypeScript as the desktop shell
- React (with TypeScript) for the renderer UI
- Core/skin separation — logic is Electron-agnostic
- Storage layer is currently is local file storage only.
- Unified memory implemented via a nullable `project_id` on memory entries
- Connectors will use MCP
- Pi integrates as an in-process, provider-like SDK module
- File/image upload: inline directly when it fits in context; fall back to RAG (chunk → embed → retrieve) only when it doesn't, and only if an embedding model is configured — otherwise reject with a clear message (no silent truncation)
- Web search is built natively via a provider-agnostic search API + tool-calling loop, not a provider's built-in search tool
- Conversation history is owned and persisted locally (SQLite); provider-side session/history storage is not used, to keep all conversation data on the user's machine
- Provider integrations are normalized behind a common interface at the boundary; shared chat logic never depends on a specific provider's SDK types
- API keys and other secrets are loaded from environment variables (`.env`, excluded from version control), never hardcoded in source

## 6. Open Decisions

- **Skills architecture** — format and execution model not yet designed
- **Exact SQLite schema** (including the vector-storage table for RAG) — intentionally left until real data (messages, memory, chunks) exists, to avoid designing a schema based on guesses
- **Which embedding model(s) to support first** for the RAG path, and which image embedding model for image-collection search
- **Which search API to use** for native web search (e.g. Brave, Tavily, SerpAPI, Bing/Google) — not yet chosen
- **Deep research feature** — design deferred until basic web search is implemented

## 7. Explicitly Out of Scope (for now)

- Authentication or multi-user support (by design — local, single-user)

## 8. Current Frontier

The core send-a-message/get-a-reply primitive exists as a standalone script (no UI, no storage, no Electron) and is the foundation every later feature builds on.

Immediate scope: a plain interactive multi-turn loop (terminal input → append to conversation → call provider → append reply → repeat), still entirely within the standalone core — no Electron, React, or database involved yet.

The provider abstraction described in 4.4 (a common interface behind which multiple AI backends sit) is introduced once a second provider is actually added, not before — the interface shape should be drawn from a real second implementation, not guessed in advance. Electron/React wiring, SQLite-backed persistence, and Pi integration all come after this core loop is solid and understood on its own.
