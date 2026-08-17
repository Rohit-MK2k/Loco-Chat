import test from "node:test"
import assert from "node:assert"
import * as dotenv from "dotenv"

import { Session } from "../../core/ai/session/session.js"
import { setOneActiveProvider } from "../../core/ai/providers/states/connectedProviders.js"
import type { Conversation, ConversationRepository } from "../../core/ai/storage/conversationRepository.js"

dotenv.config()

// ─── helpers ────────────────────────────────────────────────────────────────

const makeStore = (conv: Conversation): ConversationRepository => ({
    save: async () => {},
    load: async (id) => (id === conv.sessionId ? conv : null),
    list: async () => [conv.sessionId],
})

const nullStore: ConversationRepository = {
    save: async () => {},
    load: async () => null,
    list: async () => [],
}

// Base dummy conversations — modelId is overwritten at test time
// with a real model fetched from the provider, so tests stay valid
// even if provider model lists change.
const googleBase = [
    { sessionId: "aaaa0001-0000-0000-0000-000000000001", createdAt: 1723900000000,
      messages: [{ role: "user" as const, content: "Explain black holes." }, { role: "assistant" as const, content: "Regions of extreme gravity." }] },
    { sessionId: "aaaa0002-0000-0000-0000-000000000002", createdAt: 1723900001000,
      messages: [{ role: "user" as const, content: "Write a haiku about rain." }, { role: "assistant" as const, content: "Drops on the window..." }] },
    { sessionId: "aaaa0003-0000-0000-0000-000000000003", createdAt: 1723900002000,
      messages: [{ role: "user" as const, content: "What is TypeScript?" }, { role: "assistant" as const, content: "A typed superset of JS." },
                 { role: "user" as const, content: "Difference from JS?" }, { role: "assistant" as const, content: "Static types and compile-time checks." }] },
    { sessionId: "aaaa0004-0000-0000-0000-000000000004", createdAt: 1723900003000,
      messages: [{ role: "user" as const, content: "What is 2 + 2?" }, { role: "assistant" as const, content: "4." }] },
    { sessionId: "aaaa0005-0000-0000-0000-000000000005", createdAt: 1723900004000,
      messages: [{ role: "user" as const, content: "Translate hello to French." }, { role: "assistant" as const, content: "Bonjour." },
                 { role: "user" as const, content: "And Spanish?" }, { role: "assistant" as const, content: "Hola." }] },
]

const openRouterBase = [
    { sessionId: "aaaa0006-0000-0000-0000-000000000006", createdAt: 1723900005000,
      messages: [{ role: "user" as const, content: "What is SOLID?" }, { role: "assistant" as const, content: "Five OOP design principles." }] },
    { sessionId: "aaaa0007-0000-0000-0000-000000000007", createdAt: 1723900006000,
      messages: [{ role: "user" as const, content: "Explain dependency injection." }, { role: "assistant" as const, content: "Passing deps in instead of creating them." },
                 { role: "user" as const, content: "Why better?" }, { role: "assistant" as const, content: "Decouples classes, easier to mock." }] },
    { sessionId: "aaaa0008-0000-0000-0000-000000000008", createdAt: 1723900007000,
      messages: [{ role: "user" as const, content: "What is a closure?" }, { role: "assistant" as const, content: "Function retaining outer scope after parent returns." }] },
    { sessionId: "aaaa0009-0000-0000-0000-000000000009", createdAt: 1723900008000,
      messages: [{ role: "user" as const, content: "Name three design patterns." }, { role: "assistant" as const, content: "Singleton, Observer, Factory." },
                 { role: "user" as const, content: "Explain Singleton." }, { role: "assistant" as const, content: "Ensures one instance exists app-wide." }] },
    { sessionId: "aaaa0010-0000-0000-0000-000000000010", createdAt: 1723900009000,
      messages: [{ role: "user" as const, content: "What is REST?" }, { role: "assistant" as const, content: "Architectural style using HTTP verbs, stateless requests." }] },
]

// ─── pure unit tests (no provider needed) ───────────────────────────────────

test("Session.restore throws when session not found", async () => {
    await assert.rejects(
        () => Session.restore("non-existent-id", nullStore),
        /Session not found/
    )
})

// ─── integration tests ───────────────────────────────────────────────────────

test("Session.restore preserves sessionId — google cases", async (t) => {
    const apiKey = process.env.GOOGLE_AI_API
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set")

    await setOneActiveProvider("google", apiKey)

    // fetch real model once, reuse across all google cases
    const probe = new Session(nullStore)
    const models = (await probe.getAvailableModels())["google"] ?? []
    if (!models[0] || models.length === 0) throw new Error("No google models available")
    const modelId = models[0]
    
    for (const base of googleBase) {
        const conv: Conversation = { ...base, providerId: "google", modelId }
        t.test(`restores sessionId ${conv.sessionId}`, async () => {
            const session = await Session.restore(conv.sessionId, makeStore(conv))
            assert.strictEqual(session.sessionId, conv.sessionId)
        })
    }
})

test("Session.restore preserves sessionId — openRouter cases", async (t) => {
    const apiKey = process.env.OPENROUETER_AI_API
    if (!apiKey) throw new Error("OPENROUETER_AI_API is not set")

    await setOneActiveProvider("openRouter", apiKey)

    const probe = new Session(nullStore)
    const models = (await probe.getAvailableModels())["openRouter"] ?? []
    if (!models[0] || models.length === 0) throw new Error("No openRouter models available")
    const modelId = models[0]

    for (const base of openRouterBase) {
        const conv: Conversation = { ...base, providerId: "openRouter", modelId }
        t.test(`restores sessionId ${conv.sessionId}`, async () => {
            const session = await Session.restore(conv.sessionId, makeStore(conv))
            assert.strictEqual(session.sessionId, conv.sessionId)
        })
    }
})

// ─── wrong modelId tests ─────────────────────────────────────────────────────

test("Session.restore rejects invalid modelId — google", async () => {
    const apiKey = process.env.GOOGLE_AI_API
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set")

    await setOneActiveProvider("google", apiKey)

    const conv: Conversation = {
        sessionId: "bbbb0001-0000-0000-0000-000000000001",
        providerId: "google",
        modelId: "not-a-real-google-model",
        createdAt: Date.now(),
        messages: [{ role: "user", content: "Hello." }, { role: "assistant", content: "Hi." }],
    }

    await assert.rejects(
        () => Session.restore(conv.sessionId, makeStore(conv)),
        /not available for provider/
    )
})

test("Session.restore rejects invalid modelId — openRouter", async () => {
    const apiKey = process.env.OPENROUETER_AI_API
    if (!apiKey) throw new Error("OPENROUETER_AI_API is not set")

    await setOneActiveProvider("openRouter", apiKey)

    const conv: Conversation = {
        sessionId: "bbbb0002-0000-0000-0000-000000000002",
        providerId: "openRouter",
        modelId: "not-a-real-openrouter-model",
        createdAt: Date.now(),
        messages: [{ role: "user", content: "Hello." }, { role: "assistant", content: "Hi." }],
    }

    await assert.rejects(
        () => Session.restore(conv.sessionId, makeStore(conv)),
        /not available for provider/
    )
})
