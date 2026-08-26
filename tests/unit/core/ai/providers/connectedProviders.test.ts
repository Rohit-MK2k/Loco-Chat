import { test, beforeEach } from "node:test";
import assert from "node:assert";
import type { ProviderAuthReader, ProviderAuthConfigData } from "../../../../../src/core/ai/providers/repo/providerAuthRepository.js";

import {
    setOneActiveProvider,
    getActiveProvider,
    getActiveProvidersId,
    initActiveProvider,
    resetProviders,
} from "../../../../../src/core/ai/providers/states/connectedProviders.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeLoader = (data: ProviderAuthConfigData[]): ProviderAuthReader => ({
    load: async () => null,
    loadAll: async () => data,
    list: async () => data.map((d) => d.providerId),
});

beforeEach(() => resetProviders());

// ─── setOneActiveProvider ─────────────────────────────────────────────────────
// Only the unknown-id guard is pure — it fires before any network call.
// Invalid-key path requires validateApiKey() HTTP call → integration test.

test("setOneActiveProvider throws on unknown provider id", async () => {
    await assert.rejects(
        () => setOneActiveProvider("unknown-vendor", "any-key"),
        /Unknown provider/
    );
});

// ─── getActiveProvider ────────────────────────────────────────────────────────
// Empty-state guard is pure. Post-set behavior requires network → integration.

test("getActiveProvider throws when no providers are set", () => {
    assert.throws(
        () => getActiveProvider("google"),
        /no provider selected yet/
    );
});

// ─── getActiveProvidersId ─────────────────────────────────────────────────────
// Empty-state guard is pure. Post-set behavior requires network → integration.

test("getActiveProvidersId throws when no providers are set", () => {
    assert.throws(
        () => getActiveProvidersId(),
        /no provider selected yet/
    );
});

// ─── initActiveProvider ───────────────────────────────────────────────────────
// Empty storage and unknown-id filtering are pure — both resolve before
// any validateApiKey call. Valid-key path requires HTTP → integration.

test("initActiveProvider returns false when storage is empty", async () => {
    const result = await initActiveProvider(makeLoader([]));
    assert.strictEqual(result, false);
});

test("initActiveProvider returns false when all provider ids are unknown", async () => {
    const result = await initActiveProvider(makeLoader([
        { providerId: "unknown-vendor", apiKey: "k", activatedAt: 0, updatedAt: 0 },
    ]));
    assert.strictEqual(result, false);
});
