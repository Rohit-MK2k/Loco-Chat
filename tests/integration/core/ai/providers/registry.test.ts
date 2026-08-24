import { test } from "node:test";
import assert from "node:assert";
import * as dotenv from "dotenv";
import { getProvider } from "../../../../../src/core/ai/providers/registry.js";

// Integration: real HTTP calls to provider validation endpoints.
// Requires GOOGLE_AI_API and OPENROUTER_AI_API env vars.

dotenv.config();

const providers = [
    { id: "google", apiKey: process.env.GOOGLE_AI_API, envName: "GOOGLE_AI_API" },
    { id: "openRouter", apiKey: process.env.OPENROUTER_AI_API ?? process.env.OPENROUETER_AI_API, envName: "OPENROUTER_AI_API" },
];

providers.forEach(({ id, apiKey, envName }) => {
    test(`validateApiKey returns true for valid ${id} key`, async () => {
        if (!apiKey) throw new Error(`${envName} is not set`);
        const provider = getProvider(id, apiKey);
        const valid = await provider.validateApiKey();
        assert.strictEqual(valid, true);
    });

    test(`validateApiKey returns false for invalid ${id} key`, async () => {
        const provider = getProvider(id, "Fake_API_Key");
        const valid = await provider.validateApiKey();
        assert.strictEqual(valid, false);
    });
});
