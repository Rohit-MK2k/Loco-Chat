import { test } from "node:test";
import assert from "node:assert";
import type { ProviderSelectionDeps } from "../../../../../src/core/ai/providers/states/providerSelection.js";
import { ProviderSelection } from "../../../../../src/core/ai/providers/states/providerSelection.js";
import type { AiProvider, ProviderId } from "../../../../../src/core/ai/providers/types.js";

// --- helpers ------------------------------------------------------------------

const makeProvider = (models: string[]): AiProvider => ({
    id: "fake",
    validateApiKey: async () => true,
    listModels: async () => models,
    generateReply: async () => undefined,
});

const makeDeps = (map: Partial<Record<ProviderId, string[]>>): ProviderSelectionDeps => ({
    getActiveProvidersId: () => Object.keys(map) as ProviderId[],
    getActiveProvider: (id: ProviderId) => ({
        id,
        provider: makeProvider(map[id] ?? []),
    }),
});

// --- getAvailableModels -------------------------------------------------------

test("getAvailableModels returns models keyed by provider id", async () => {
    const ps = new ProviderSelection(makeDeps({ google: ["gemini-2.0-flash"] }));
    const result = await ps.getAvailableModels();
    assert.deepStrictEqual(result, { google: ["gemini-2.0-flash"] });
});

test("getAvailableModels returns models for multiple providers", async () => {
    const ps = new ProviderSelection(makeDeps({
        google: ["gemini-2.0-flash"],
        openrouter: ["gpt-4o"],
    }));
    const result = await ps.getAvailableModels();
    assert.deepStrictEqual(result, {
        google: ["gemini-2.0-flash"],
        openrouter: ["gpt-4o"],
    });
});

test("getAvailableModels caches result - listModels called once on second call", async () => {
    let callCount = 0;
    const deps: ProviderSelectionDeps = {
        getActiveProvidersId: () => ["google" as ProviderId],
        getActiveProvider: (id) => ({
            id,
            provider: {
                id: "fake",
                validateApiKey: async () => true,
                listModels: async () => { callCount++; return ["gemini-2.0-flash"]; },
                generateReply: async () => undefined,
            },
        }),
    };

    const ps = new ProviderSelection(deps);
    await ps.getAvailableModels();
    await ps.getAvailableModels();

    assert.strictEqual(callCount, 1);
});

test("getAvailableModels forceRefresh bypasses cache - listModels called twice", async () => {
    let callCount = 0;
    const deps: ProviderSelectionDeps = {
        getActiveProvidersId: () => ["google" as ProviderId],
        getActiveProvider: (id) => ({
            id,
            provider: {
                id: "fake",
                validateApiKey: async () => true,
                listModels: async () => { callCount++; return ["gemini-2.0-flash"]; },
                generateReply: async () => undefined,
            },
        }),
    };

    const ps = new ProviderSelection(deps);
    await ps.getAvailableModels();
    await ps.getAvailableModels(true);

    assert.strictEqual(callCount, 2);
});

// --- select -------------------------------------------------------------------

test("select throws when provider is not in available list", async () => {
    const ps = new ProviderSelection(makeDeps({ google: ["gemini-2.0-flash"] }));
    await assert.rejects(
        () => ps.select("openrouter", "gpt-4o"),
        /Provider not connected: openrouter/
    );
});

test("select throws when model is not available for provider", async () => {
    const ps = new ProviderSelection(makeDeps({ google: ["gemini-2.0-flash"] }));
    await assert.rejects(
        () => ps.select("google", "gpt-4o"),
        /Model "gpt-4o" is not available for provider "google"/
    );
});

test("select sets provider and model on valid input", async () => {
    const ps = new ProviderSelection(makeDeps({ google: ["gemini-2.0-flash"] }));
    await ps.select("google", "gemini-2.0-flash");
    assert.deepStrictEqual(ps.getSelection(), {
        providerId: "google",
        modelId: "gemini-2.0-flash",
    });
});

// --- getSelection -------------------------------------------------------------

test("getSelection throws when called before select", () => {
    const ps = new ProviderSelection(makeDeps({}));
    assert.throws(
        () => ps.getSelection(),
        /No provider and model selected/
    );
});

test("getSelection returns correct provider and model after select", async () => {
    const ps = new ProviderSelection(makeDeps({
        google: ["gemini-2.0-flash"],
        openrouter: ["gpt-4o"],
    }));
    await ps.select("openrouter", "gpt-4o");
    assert.deepStrictEqual(ps.getSelection(), {
        providerId: "openrouter",
        modelId: "gpt-4o",
    });
});
