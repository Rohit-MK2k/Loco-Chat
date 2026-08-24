import { test } from "node:test";
import assert from "node:assert";
import { getProvider, ListProviderId } from "../../../../../src/core/ai/providers/registry.js";
import type { ProviderId } from "../../../../../src/core/ai/providers/types.js";

// Unit: no network calls. Only verifies the factory resolves the correct
// provider instance and that the registry knows its own keys.

const KNOWN_PROVIDER_IDS: ProviderId[] = ["google", "openrouter"];

test("getProvider returns provider with matching id — google", () => {
    const provider = getProvider("google", "any-key");
    assert.strictEqual(provider.id, "google");
});

test("getProvider returns provider with matching id — openrouter", () => {
    const provider = getProvider("openrouter", "any-key");
    assert.strictEqual(provider.id, "openrouter");
});

test("ListProviderId returns exactly the expected provider ids", () => {
    const ids = ListProviderId().sort();
    assert.deepStrictEqual(ids, [...KNOWN_PROVIDER_IDS].sort());
});
