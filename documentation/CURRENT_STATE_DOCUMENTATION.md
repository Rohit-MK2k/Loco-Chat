# LocoChat — Current Architecture & Implementation Status

## 1. Executive Summary

This document provides a comprehensive technical overview of the LocoChat codebase in its current state, detailing all implemented components, architectural patterns, design decisions, data structures, and a gap analysis against the target product specification defined in [LocoChat.md](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/documentation/LocoChat.md).

LocoChat is designed as a local-first desktop AI chat application. Currently, the project is in **Phase 0/Core Foundation**: the core, headless conversation loop, hybrid streaming provider abstraction layer (`stream()` with optional `onChunk` callback and full promise resolution), error classification, key validation/storage mechanisms, session lifecycle management, and repository persistence layers are fully implemented in pure TypeScript with zero UI/Electron dependencies.

---

## 2. System Architecture

The project strictly adheres to the **Core/Skin Separation** architectural boundary:

```
+---------------------------------------------------------------+
|                       Renderer UI (React)                     | (Planned)
+---------------------------------------------------------------+
                               | IPC
+---------------------------------------------------------------+
|                      Electron Main Process                    | (Planned)
+---------------------------------------------------------------+
                               | Direct Method Calls
+---------------------------------------------------------------+
|                      LocoChat Core Engine                     | (CURRENT FOCUS)
|                                                               |
|  +---------------------+           +-----------------------+  |
|  |    Session Engine   | <-------> |   Provider Selection  |  |
|  |  (`Session` entity) |           |  (`ProviderSelection`)|  |
|  +---------------------+           +-----------------------+  |
|             |                                  |              |
|             v                                  v              |
|  +---------------------+           +-----------------------+  |
|  |  Session Repository |           |   Connected Providers |  |
|  | (`SessionRepository`|           |  (`connectedProviders`|  |
|  +---------------------+           +-----------------------+  |
|             |                                  |              |
|             v                                  v              |
|  +---------------------+           +-----------------------+  |
|  |  JsonSessionStore   |           |    Provider Registry  |  |
|  |  (Local filesystem) |           | (`registry.ts`)       |  |
|  +---------------------+           +-----------------------+  |
|                                                |              |
|                                                v              |
|                                    +-----------------------+  |
|                                    |  BasePiAiProvider /   |  |
|                                    |  Concrete Providers   |  |
|                                    | (Gemini, OpenRouter)  |  |
|                                    +-----------------------+  |
|                                      |                   |    |
|                                      v                   v    |
|                          +--------------------+ +-----------+ |
|                          | Error Classifier   | | Auth Store| |
|                          | (`errors.ts`)      | | (Json/Env)| |
|                          +--------------------+ +-----------+ |
+---------------------------------------------------------------+
```

### Key Architectural Tenets

1. **Zero UI Coupling in Core:** All modules in [`src/core/`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core) operate as standalone Node.js / TypeScript code. They possess no knowledge of Electron, Chromium, IPC channels, or DOM elements.
2. **Provider-Agnostic Canonical Messaging:** Conversations are expressed using a single internal message format ([`AppMessage`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L1-L5)). Translation to external provider wire formats occurs exclusively at the provider adapter boundary.
3. **Hybrid Streaming Pattern:** The core execution layer uses streaming under the hood (`modelsCollection.stream()`). Chunks are emitted in real-time via an optional callback (`ChunkCallback`), while the full reply is resolved as a `Promise<string>` to guarantee atomic database persistence once completion finishes.
4. **Repository Pattern with Storage Isolation:** All persistence operations go through explicit repository interfaces, allowing painless swapping between environment variables, JSON files, and future SQLite databases.

---

## 3. Subsystem Breakdown & Implemented Codebase

### 3.1 AI Provider Subsystem

The provider subsystem manages AI model interactions, streaming transformations, vendor abstraction using `@earendil-works/pi-ai`, and vendor error classification.

- **Contracts & Domain Types ([`src/core/ai/providers/types.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts)):**
  - [`AppMessage`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L1-L5): Represents a canonical message with fields `role` (`"user" | "assistant"`), `content` (string), and `timestamp` (number).
  - [`ChunkCallback`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L7): Callback type `(chunk: string) => void` for streaming text deltas.
  - [`ProviderId`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L16): Union type `"google" | "openrouter"`.
  - [`AiProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L9-L14): Interface requiring `id`, `validateApiKey()`, `listModels()`, and `generateReply(messages, model, onChunk?)`.

- **Base Provider Adapter ([`src/core/ai/providers/BasePiAiProvider.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/BasePiAiProvider.ts)):**
  - Abstract class implementing [`AiProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L9-L14).
  - Encapsulates `@earendil-works/pi-ai`'s `modelsCollection`.
  - Normalizes canonical [`AppMessage[]`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L1-L5) into pi-ai's `Context` / `Message` structures.
  - Dispatches streaming requests via `modelsCollection.stream()`, emits `text_delta` tokens live via `onChunk?.(event.delta)`, and awaits `stream.result()` for terminal response status.
  - Passes raw failure messages through [`classifyProviderError`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/errors.ts#L33-L45) to detect model deprecations or routing errors before falling back to generic provider errors.

- **Error Handling & Classification ([`src/core/ai/providers/errors.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/errors.ts)):**
  - [`ModelUnavailableError`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/errors.ts#L3-L13): Custom error carrying `providerId`, `modelId`, optional `suggestedModel`, and original `rawMessage`.
  - [`classifyProviderError(providerId, modelId, rawMessage)`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/errors.ts#L33-L45): Regex-based classifier detecting upstream deprecations (e.g. Google's sunset models with suggested replacements or OpenRouter missing endpoint routing).

- **Concrete Provider Implementations:**
  - [`GeminiProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/gemini.ts): Implements Google Gemini using `googleProvider` from `@earendil-works/pi-ai/providers/google`. Performs live API key verification against `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`.
  - [`OpenrouterProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/openrouter.ts): Implements OpenRouter using `openrouterProvider` from `@earendil-works/pi-ai/providers/openrouter`. Performs live API key validation against `https://openrouter.ai/api/v1/auth/key` and handles dynamic model discovery.

- **Provider Registry ([`src/core/ai/providers/registry.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/registry.ts)):**
  - Decouples instantiation from configuration using factory functions `(apiKey: string) => AiProvider`.
  - Functions: [`getProvider(id, apiKey)`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/registry.ts#L13-L19) and [`ListProviderId()`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/registry.ts#L21-L23).

- **Connected Providers State ([`src/core/ai/providers/states/connectedProviders.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/states/connectedProviders.ts)):**
  - Manages in-memory active providers whose credentials have passed validation.
  - Functions: `setOneActiveProvider`, `setAllActiveProviders`, `getActiveProvider`, `getActiveProvidersId`, `initActiveProvider(loader)`, and `resetProviders()` (for test isolation).

- **Provider & Model Selection State ([`src/core/ai/providers/states/providerSelection.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/states/providerSelection.ts)):**
  - Encapsulates per-session active provider and model choices.
  - In-memory caching: `getAvailableModels(forceRefresh = false)` caches model listings on the instance to prevent redundant network round-trips on repeated selections.

---

### 3.2 Provider Authentication & Storage Subsystem

Manages API keys adhering to the Repository Pattern and Interface Segregation Principle:

- **Repository Contracts ([`src/core/ai/providers/repo/providerAuthRepository.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts)):**
  - [`ProviderAuthConfigData`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L1-L6): Domain entity with `providerId`, `apiKey`, `activatedAt`, and `updatedAt`.
  - [`ProviderAuthReader`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L8-L12): Interface for read operations (`load`, `loadAll`, `list`).
  - [`ProviderAuthWriter`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L14-L16): Interface for write operations (`save`).
  - [`ProviderAuthRepository`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L19): Combined interface for read-write stores.

- **Concrete Stores:**
  - [`EnvProviderStore`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/storage/envProviderStore.ts): Implements `ProviderAuthReader` to source keys from environment variables (`GOOGLE_AI_API`, `OPENROUTER_AI_API`).
  - [`JsonProviderAuthStorage`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/storage/jsonAuthStorage.ts): Implements `ProviderAuthRepository` using local file storage (`auth.json` in `~/.locoChat` in production, or `./data` in development).

---

### 3.3 Session & Conversation Subsystem

Handles the chat lifecycle, multi-turn dialogue, model switching, and persistence:

- **Domain Model & Contract ([`src/core/ai/session/repo/sessionRepository.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/sessionRepository.ts)):**
  - [`SessionData`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/sessionRepository.ts#L3-L12): Serialized session format containing `sessionId`, `title`, `projectId: string | null`, `messages: AppMessage[]`, `providerId`, `modelId`, `createdAt`, and `lastUsedAt`.
  - [`SessionRepository`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/sessionRepository.ts#L14-L19): Abstract contract defining `save(sessionData)`, `load(sessionId)`, `list()`, and `delete(sessionId)`.

- **Concrete Storage ([`src/core/ai/session/repo/storage/jsonSessionStore.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/storage/jsonSessionStore.ts)):**
  - Implements `SessionRepository` using flat JSON files (`<sessionId>.json`) stored in `~/.locoChat/conversations` (prod) or `./data/conversations` (dev).
  - Includes `delete(sessionId)` using `fs.unlink()`.

- **Session Service Entity ([`src/core/ai/session/session.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts)):**
  - [`Session`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts):
    - Initializes with UUID, immutable `createdAt`, `title`, nullable `projectId`, and internal `ProviderSelection`.
    - [`sendMessage(text, onChunk?)`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts#L44-L65): Appends user message with timestamp, invokes provider with optional `onChunk` streaming callback, appends assistant message, and persists updated `SessionData` with `lastUsedAt: Date.now()`.
    - [`Session.restore(sessionId, store)`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts#L28-L35): Static factory that loads stored session data, reconstructs dialogue history, restores metadata (`title`, `projectId`, `createdAt`), and validates provider/model selections.

---

### 3.4 Automated Test Suite

LocoChat organizes tests into a clean 3-tier hierarchy using the native Node.js test runner (`node:test`) and strict assertions (`node:assert`):

```
tests/
├── unit/            # Fast, isolated, zero-network tests
│   ├── core/ai/providers/
│   │   ├── connectedProviders.test.ts  # State guards, filtering, and reset
│   │   ├── errors.test.ts              # ModelUnavailableError & classifier regexes
│   │   ├── providerSelection.test.ts   # In-memory caching, selection guards
│   │   └── registry.test.ts            # Factory resolution & key validation
│   └── core/ai/session/
│       └── session.test.ts             # Session guard and restore error logic
├── integration/     # Live network tests verifying external provider contracts
│   ├── core/ai/providers/
│   │   ├── connectedProviders.test.ts  # Live API key verification flows
│   │   ├── providers.test.ts           # Remote model listing and auth endpoints
│   │   └── registry.test.ts            # Live key rejection & validation
│   └── core/ai/session/
│       └── session.test.ts             # Live model acceptance, invalid rejection, restore
└── smoke/           # End-to-end LLM completion & deprecation checks (CI/Manual)
    └── core/ai/providers/
        └── providers.smoke.test.ts     # Live streaming replies & ModelUnavailableError
```

#### Test Runner Commands
- `npm test` or `npm run test:unit`: Runs fast unit tests (`tests/unit/**/*.test.ts`).
- `npm run test:integration`: Runs provider integration tests requiring valid `.env` keys (`tests/integration/**/*.test.ts`).
- `npm run test:smoke`: Runs live LLM completion and deprecation checks (`tests/smoke/**/*.test.ts`).
- `npm run test:all`: Executes both unit and integration suites.

---

## 4. Design Principles & Patterns in the Codebase

### 4.1 Repository Design Pattern

All persistence operations follow the four standard components:

1. **Domain Model (Entity):** [`SessionData`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/sessionRepository.ts#L3-L12), [`ProviderAuthConfigData`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L1-L6).
2. **Repository Interface:** [`SessionRepository`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/sessionRepository.ts#L14-L19), [`ProviderAuthRepository`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L19).
3. **Concrete Repository:** [`JsonSessionStore`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/storage/jsonSessionStore.ts), [`JsonProviderAuthStorage`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/storage/jsonAuthStorage.ts), [`EnvProviderStore`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/storage/envProviderStore.ts).
4. **Client/Service Layer:** [`Session`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts) and [`connectedProviders`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/states/connectedProviders.ts) consume repository interfaces exclusively.

### 4.2 SOLID Principles Adherence

- **Single Responsibility Principle (SRP):**
  - [`BasePiAiProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/BasePiAiProvider.ts) only handles stream dispatch and token transformation.
  - [`errors.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/errors.ts) only parses upstream messages and classifies model availability.
  - [`registry.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/registry.ts) only manufactures provider instances.
  - [`connectedProviders.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/states/connectedProviders.ts) only holds active authenticated provider state.
  - [`Session`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts) only orchestrates the conversational flow and persistence timing.
- **Open/Closed Principle (OCP):**
  - New providers can be added simply by extending [`BasePiAiProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/BasePiAiProvider.ts) and registering the factory in [`registry.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/registry.ts) without modifying existing chat or session logic.
- **Liskov Substitution Principle (LSP):**
  - Any [`AiProvider`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L9-L14) implementation can be substituted in [`connectedProviders`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/states/connectedProviders.ts) and [`Session`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts) seamlessly.
- **Interface Segregation Principle (ISP):**
  - Auth storage separates [`ProviderAuthReader`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L8-L12) from [`ProviderAuthWriter`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/repo/providerAuthRepository.ts#L14-L16).
- **Dependency Inversion Principle (DIP):**
  - High-level modules ([`Session`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/session.ts)) depend on abstractions ([`SessionRepository`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/session/repo/sessionRepository.ts#L14-L19)), enabling effortless unit testing with mock stores.

### 4.3 DRY & Pragmatic Abstraction

- Canonical [`AppMessage`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/core/ai/providers/types.ts#L1-L5) avoids duplicating message conversion across different services.
- `BasePiAiProvider` centralizes streaming loops, token accumulation, and response unwrapping across providers.
- In-memory model caching inside `ProviderSelection` prevents redundant HTTP requests during repeated model switches or validations.

---

## 5. Specification Comparison & Gap Analysis

Comparison between the target specification in [LocoChat.md](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/documentation/LocoChat.md) and the current implementation:

| Section in `LocoChat.md` | Target Specification | Current Status in Codebase | Implementation Details / Gaps |
|---|---|---|---|
| **2. Tech Stack & Electron Shell** | Electron desktop app + React renderer + TypeScript + `@earendil-works/pi-ai` | **Partially Done** | Pure TypeScript core + `@earendil-works/pi-ai` is built and verified. Electron shell, IPC bridge, and React UI are not yet started. |
| **3. Core/Skin Separation** | Core application logic is pure Node.js/TS with zero UI/Electron coupling | **Completed** | Clean separation achieved. Core has no UI/Electron dependencies. |
| **4.1 No Auth / Local First** | Single-user, zero server hosting, local storage | **Completed** | All sessions and credentials stored locally in `~/.locoChat` or `./data`. |
| **4.2 Multi-Provider AI Support** | Multi-vendor BYOK support with runtime provider & model switching | **In Progress** | `GeminiProvider` (Google) and `OpenrouterProvider` (OpenRouter) fully implemented with validation, dynamic model selection, and error classification. Remaining providers (OpenAI, Anthropic, Ollama, Bedrock, etc.) planned. |
| **4.3 Conversation History** | Local JSON session persistence, save, restore, list, delete | **Completed** | Full `SessionRepository`, `JsonSessionStore`, and `Session.restore()` implemented with lifecycle timestamps and deletion support. |
| **4.4 File & Photo Upload** | Inline files/images directly; RAG retrieval fallback for large documents | **Not Started** | Needs renderer file picker IPC + base64/document payload generation + RAG chunking pipeline. |
| **4.5 Projects** | Project instructions and scoped memory | **Partially Modeled** | `projectId: string \| null` is modeled on `Session` and `SessionData`. Project CRUD, project instructions, and scoping logic are pending. |
| **4.6 Unified Memory** | Two-tier memory (Global vs Project-scoped) via nullable `project_id` | **Not Started** | Conceptual model documented; memory repository, storage, and prompt injection pipeline pending. |
| **4.7 Skills & Connectors** | MCP (Model Context Protocol) connectors | **Not Started** | Architecture pending. |
| **4.8 Tool Support** | Tool use loop (Model -> Tool Call -> Core Execution -> Tool Result) | **Not Started** | Streaming text generation is complete. Tool-calling loops and callbacks pending. |
| **4.9 Pi Coding Agent** | In-process `@earendil-works/pi-coding-agent` integration | **Not Started** | Core provider module currently uses `@earendil-works/pi-ai`. In-process coding agent session pending. |
| **4.10 Native Web Search** | Custom provider-agnostic search tool loop | **Not Started** | Search API selection and tool-calling execution pending. |

---

## 6. Data Storage & Schemas

### 6.1 Session Storage Format (`<sessionId>.json`)

Located at `~/.locoChat/conversations/<sessionId>.json` (or `./data/conversations/<sessionId>.json` in dev):

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Chat with google",
  "projectId": null,
  "providerId": "google",
  "modelId": "gemini-3.6-flash",
  "createdAt": 1723900000000,
  "lastUsedAt": 1723900001000,
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": 1723900000000
    },
    {
      "role": "assistant",
      "content": "Hello! How can I help you today?",
      "timestamp": 1723900001000
    }
  ]
}
```

### 6.2 Provider Authentication Storage (`auth.json`)

Located at `~/.locoChat/auth.json` (or `./data/auth.json` in dev):

```json
{
  "google": {
    "providerId": "google",
    "apiKey": "AIzaSy...",
    "activatedAt": 1723900000000,
    "updatedAt": 1723900000000
  },
  "openrouter": {
    "providerId": "openrouter",
    "apiKey": "sk-or-v1-...",
    "activatedAt": 1723900000000,
    "updatedAt": 1723900000000
  }
}
```

---

## 7. Roadmap & Next Implementation Steps

1. **Interactive CLI / Core Multi-turn Runner:**
   - Wire [`src/index.ts`](file:///C:/Users/kakal/Documents/Rohit%27s/Projects/LocoChat/src/index.ts) with `node:readline` to test live multi-turn streaming directly from the terminal.
2. **Provider Expansion:**
   - Add OpenAI, Anthropic, and Ollama (local LLMs) providers.
3. **Projects & Unified Memory Implementation:**
   - Build `ProjectRepository` and `MemoryRepository` with `project_id` scoping.
   - Inject project instructions and memory into session prompts.
4. **Tool Calling Loop & Web Search:**
   - Expand `ChunkCallback` into structured event callbacks (`onToolStart`, `onToolEnd`).
   - Implement tool calling execution loop and native web search.
5. **Desktop Shell Integration:**
   - Scaffold Electron main process, preload script, and React UI.
   - Forward streaming chunks across IPC via `event.sender.send("chat:chunk", delta)`.

