import { test } from "node:test";
import assert from "node:assert";
import { getProvider, ListProviderId } from "../../../../../src/core/ai/providers/registry.js";

// Unit: no network calls. Only verifies the factory resolves the correct
// provider instance and that the registry knows its own keys.

test("getProvider returns provider with matching id — google", () => {
    const provider = getProvider("google", "any-key");
    assert.strictEqual(provider.id, "google");
});

test("getProvider returns provider with matching id — openRouter", () => {
    const provider = getProvider("openRouter", "any-key");
    assert.strictEqual(provider.id, "openrouter");
});

test("getProvider throws on unknown provider id", () => {
    assert.throws(
        () => getProvider("unknown-provider", "any-key"),
        /Unknown Provider/
    );
});

test("ListProviderId returns all registered provider ids", () => {
    const ids = ListProviderId();
    assert.ok(ids.includes("google"), "missing google");
    assert.ok(ids.includes("openRouter"), "missing openRouter");
});
