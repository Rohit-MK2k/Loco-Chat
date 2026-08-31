import test from "node:test";
import assert from "node:assert";
import * as dotenv from "dotenv";
import { Session } from "../../../../../src/core/ai/session/session.js";
import { setOneActiveProvider } from "../../../../../src/core/ai/providers/states/connectedProviders.js";
import type { SessionData, SessionRepository } from "../../../../../src/core/ai/session/repo/sessionRepository.js";
import type { ProviderId } from "../../../../../src/core/ai/providers/types.js";

// Integration: real provider API calls to list and validate models.
// Requires GOOGLE_AI_API and OPENROUTER_AI_API env vars.

dotenv.config();

const nullStore: SessionRepository = {
    save: async () => {},
    load: async () => null,
    list: async () => [],
    delete: async () => {},
};

const makeStore = (sess: SessionData): SessionRepository => ({
    save: async () => {},
    load: async (id) => (id === sess.sessionId ? sess : null),
    list: async () => [sess.sessionId],
    delete: async () => {},
});


type ProviderTestCase = {
    id: ProviderId,
    apiKey: string | undefined,
    envName: string
}
const testProviders: ProviderTestCase[] = [
    { id: "google", apiKey: process.env.GOOGLE_AI_API, envName: "GOOGLE_AI_API" },
    { id: "openrouter", apiKey: process.env.OPENROUTER_AI_API, envName: "OPENROUTER_AI_API" },
];

// ─── session model selection ─────────────────────────────────────────────────

testProviders.forEach(({ id, apiKey, envName }) => {
    test(`Session accepts every model advertised by ${id}`, async (t) => {
        if (!apiKey) throw new Error(`${envName} is not set`);

        await setOneActiveProvider(id, apiKey);

        const session = new Session(nullStore);
        const availableModels = await session.getAvailableModels();
        const modelList = availableModels[id] ?? [];

        if (modelList.length === 0) throw new Error(`No model found for provider ${id}`);

        modelList.forEach((modelId) => {
            t.test(`accepts model ${modelId}`, async () => {
                await assert.doesNotReject(() => session.selectModel(id, modelId));
            });
        });
    });
});

test("Session rejects model not offered by selected provider", async () => {
    const apiKey = process.env.GOOGLE_AI_API;
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set");

    await setOneActiveProvider("google", apiKey);
    const session = new Session(nullStore);

    await assert.rejects(
        () => session.selectModel("google", "not-a-real-model"),
        /not available for provider/
    );

    await assert.doesNotReject(() => session.selectModel("google", "gemini-3-flash-preview"));
});

// ─── session restore ─────────────────────────────────────────────────────────

testProviders.forEach(({ id, apiKey, envName }) => {
    test(`Session.restore preserves session state — ${id}`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`);

        await setOneActiveProvider(id, apiKey);

        const probe = new Session(nullStore);
        const models = (await probe.getAvailableModels())[id] ?? [];
        if (!models[0]) throw new Error(`No models available for ${id}`);

        const fixture: SessionData = {
            sessionId: `test-session-${id}-0001`,
            title: `Chat with ${id}`,
            projectId: null,
            providerId: id,
            modelId: models[0],
            createdAt: 1723900000000,
            lastUsedAt: 1723900001000,
            messages: [
                { role: "user", content: "Hello", timestamp: 1723900000000 },
                { role: "assistant", content: "Hi there!", timestamp: 1723900001000 },
            ],
        };

        const session = await Session.restore(fixture.sessionId, makeStore(fixture));
        assert.strictEqual(session.sessionId, fixture.sessionId);
        assert.strictEqual(session.createdAt, fixture.createdAt);
        assert.strictEqual(session.title, fixture.title);
        assert.strictEqual(session.projectId, fixture.projectId);
    });

    test(`Session.restore rejects invalid modelId — ${id}`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`);

        await setOneActiveProvider(id, apiKey);

        const invalidSession: SessionData = {
            sessionId: `test-invalid-${id}-0001`,
            title: "Invalid Model Chat",
            projectId: null,
            providerId: id,
            modelId: `not-a-real-${id}-model`,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            messages: [{ role: "user", content: "Hello.", timestamp: Date.now() }],
        };

        await assert.rejects(
            () => Session.restore(invalidSession.sessionId, makeStore(invalidSession)),
            /not available for provider/
        );
    });
});
