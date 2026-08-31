import { test } from "node:test";
import assert from "node:assert";
import * as dotenv from "dotenv";
import { GeminiProvider } from "../../../../../src/core/ai/providers/gemini.js";
import { OpenrouterProvider } from "../../../../../src/core/ai/providers/openrouter.js";
import type { ProviderId } from "../../../../../src/core/ai/providers/types.js";

// Integration: real listModels network calls.
// Requires GOOGLE_AI_API and OPENROUTER_AI_API env vars.

dotenv.config();

type ProviderCase = {
    id: ProviderId;
    instance: GeminiProvider | OpenrouterProvider;
    envName: string;
};

const providers: ProviderCase[] = [
    {
        id: "google",
        instance: new GeminiProvider(process.env.GOOGLE_AI_API ?? ""),
        envName: "GOOGLE_AI_API",
    },
    {
        id: "openrouter",
        instance: new OpenrouterProvider(
            process.env.OPENROUTER_AI_API ?? process.env.OPENROUETER_AI_API ?? ""
        ),
        envName: "OPENROUTER_AI_API",
    },
];

// --- listModels ---------------------------------------------------------------

providers.forEach(({ id, instance, envName }) => {
    test(`listModels returns non-empty string array — ${id}`, async () => {
        if (!process.env[envName]) throw new Error(`${envName} is not set`);
        const models = await instance.listModels();
        assert.ok(models.length > 0, "expected at least one model");
        assert.ok(
            models.every((m) => typeof m === "string"),
            "all entries should be strings"
        );
    });
});
