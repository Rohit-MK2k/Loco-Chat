import test from "node:test"
import assert from "node:assert"
import * as dotenv from "dotenv"

import { Session } from "../../core/ai/session/session.js"
import { setOneActiveProvider } from "../../core/ai/providers/states/connectedProviders.js"
import type { SessionData, SessionRepository } from "../../core/ai/session/repo/sessionRepository.js"

dotenv.config()

// ─── helpers ────────────────────────────────────────────────────────────────

const makeStore = (sess: SessionData): SessionRepository => ({
    save: async () => {},
    load: async (id) => (id === sess.sessionId ? sess : null),
    list: async () => [sess.sessionId],
})

const nullStore: SessionRepository = {
    save: async () => {},
    load: async () => null,
    list: async () => [],
}

// ─── pure unit tests (no provider needed) ───────────────────────────────────

test("Session.restore throws when session not found", async () => {
    await assert.rejects(
        () => Session.restore("non-existent-id", nullStore),
        /Session not found/
    )
})

// ─── integration tests ───────────────────────────────────────────────────────

const testProviders = [
    { id: "google", apiKey: process.env.GOOGLE_AI_API, envName: "GOOGLE_AI_API" },
    { id: "openRouter", apiKey: process.env.OPENROUTER_AI_API ?? process.env.OPENROUETER_AI_API, envName: "OPENROUTER_AI_API" },
]

testProviders.forEach(({ id, apiKey, envName }) => {
    test(`Session.restore preserves session state — ${id}`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`)

        await setOneActiveProvider(id, apiKey)

        const probe = new Session(nullStore)
        const models = (await probe.getAvailableModels())[id] ?? []
        if (!models[0]) throw new Error(`No models available for ${id}`)

        const fixture: SessionData = {
            sessionId: `test-session-${id}-0001`,
            providerId: id,
            modelId: models[0],
            createdAt: 1723900000000,
            messages: [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there!" },
            ],
        }

        const session = await Session.restore(fixture.sessionId, makeStore(fixture))
        assert.strictEqual(session.sessionId, fixture.sessionId)
    })

    test(`Session.restore rejects invalid modelId — ${id}`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`)

        await setOneActiveProvider(id, apiKey)

        const invalidSession: SessionData = {
            sessionId: `test-invalid-${id}-0001`,
            providerId: id,
            modelId: `not-a-real-${id}-model`,
            createdAt: Date.now(),
            messages: [{ role: "user", content: "Hello." }, { role: "assistant", content: "Hi." }],
        }

        await assert.rejects(
            () => Session.restore(invalidSession.sessionId, makeStore(invalidSession)),
            /not available for provider/
        )
    })
})
