import { test, beforeEach } from "node:test";
import assert from "node:assert";
import * as dotenv from "dotenv";
import type { ProviderAuthConfigData, ProviderAuthReader } from "../../../../../src/core/ai/providers/repo/providerAuthRepository.js";
import type { ProviderId } from "../../../../../src/core/ai/providers/types.js";
import {
    setOneActiveProvider,
    getActiveProvider,
    getActiveProvidersId,
    initActiveProvider,
    resetProviders,
} from "../../../../../src/core/ai/providers/states/connectedProviders.js";

// Integration: real validateApiKey HTTP calls.
// Requires GOOGLE_AI_API and OPENROUTER_AI_API env vars.

dotenv.config();

// ─── helpers ──────────────────────────────────────────────────────────────────

type ProviderCase = { id: ProviderId; apiKey: string | undefined; envName: string };

const providers: ProviderCase[] = [
    { id: "google",      apiKey: process.env.GOOGLE_AI_API,                                             envName: "GOOGLE_AI_API"      },
    { id: "openrouter",  apiKey: process.env.OPENROUTER_AI_API ?? process.env.OPENROUETER_AI_API,       envName: "OPENROUTER_AI_API"  },
];

const makeLoader = (data: ProviderAuthConfigData[]): ProviderAuthReader => ({
    load: async () => null,
    loadAll: async () => data,
    list: async () => data.map((d) => d.providerId),
});

const entry = (id: ProviderId, apiKey: string): ProviderAuthConfigData => ({
    providerId: id, apiKey, activatedAt: 0, updatedAt: 0,
});

beforeEach(() => resetProviders());

// ─── setOneActiveProvider ─────────────────────────────────────────────────────

providers.forEach(({ id, apiKey, envName }) => {
    test(`setOneActiveProvider resolves with valid key — ${id}`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`);
        await assert.doesNotReject(() => setOneActiveProvider(id, apiKey));
    });

    test(`setOneActiveProvider throws Invalid API key with bad key — ${id}`, async () => {
        await assert.rejects(
            () => setOneActiveProvider(id, "Fake_API_Key"),
            /Invalid API key/
        );
    });
});

// ─── getActiveProvider ────────────────────────────────────────────────────────

providers.forEach(({ id, apiKey, envName }) => {
    test(`getActiveProvider returns matching id after activation — ${id}`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`);
        await setOneActiveProvider(id, apiKey);
        const { id: returnedId, provider } = getActiveProvider(id);
        assert.strictEqual(returnedId, id);
        assert.ok(provider, "provider instance should not be null");
    });
});

test("getActiveProvider throws provider not found when id not in active set", async () => {
    const { apiKey } = providers[0];
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set");
    await setOneActiveProvider("google", apiKey);
    assert.throws(
        () => getActiveProvider("openrouter"),
        /provider not found/
    );
});

// ─── getActiveProvidersId ─────────────────────────────────────────────────────

test("getActiveProvidersId returns id of single activated provider", async () => {
    const { apiKey } = providers[0];
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set");
    await setOneActiveProvider("google", apiKey);
    assert.deepStrictEqual(getActiveProvidersId(), ["google"]);
});

test("getActiveProvidersId returns ids of all activated providers", async () => {
    const [google, openrouter] = providers;
    if (!google.apiKey)     throw new Error("GOOGLE_AI_API is not set");
    if (!openrouter.apiKey) throw new Error("OPENROUTER_AI_API is not set");
    await setOneActiveProvider("google",     google.apiKey);
    await setOneActiveProvider("openrouter", openrouter.apiKey);
    const ids = getActiveProvidersId().sort();
    assert.deepStrictEqual(ids, ["google", "openrouter"].sort());
});

// ─── initActiveProvider ───────────────────────────────────────────────────────

test("initActiveProvider returns true when loader has valid provider and key", async () => {
    const { apiKey } = providers[0];
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set");
    const result = await initActiveProvider(makeLoader([entry("google", apiKey)]));
    assert.strictEqual(result, true);
});

test("initActiveProvider skips invalid key, returns false when none remain", async () => {
    const result = await initActiveProvider(makeLoader([entry("google", "Fake_API_Key")]));
    assert.strictEqual(result, false);
});

test("initActiveProvider keeps valid, skips invalid key in mixed batch", async () => {
    const [google, openrouter] = providers;
    if (!google.apiKey) throw new Error("GOOGLE_AI_API is not set");
    await initActiveProvider(makeLoader([
        entry("google",     google.apiKey),
        entry("openrouter", "Fake_API_Key"),
    ]));
    assert.deepStrictEqual(getActiveProvidersId(), ["google"]);
});

test("initActiveProvider keeps valid, skips unknown id in mixed batch", async () => {
    const { apiKey } = providers[0];
    if (!apiKey) throw new Error("GOOGLE_AI_API is not set");
    // unknown-vendor will be dropped by isProviderId before validateApiKey
    await initActiveProvider(makeLoader([
        entry("google", apiKey),
        { providerId: "unknown-vendor", apiKey: "k", activatedAt: 0, updatedAt: 0 },
    ]));
    assert.deepStrictEqual(getActiveProvidersId(), ["google"]);
});
