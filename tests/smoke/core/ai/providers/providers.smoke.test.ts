import { test } from "node:test";
import assert from "node:assert";
import * as dotenv from "dotenv";
import { GeminiProvider } from "../../../../../src/core/ai/providers/gemini.js";
import { OpenrouterProvider } from "../../../../../src/core/ai/providers/openrouter.js";
import { ModelUnavailableError } from "../../../../../src/core/ai/providers/errors.js";
import type { ProviderId } from "../../../../../src/core/ai/providers/types.js";

// Smoke tests: real LLM completion calls.
// Slow and cost money � run manually or in CI only.
// Run with: npm run test:smoke

dotenv.config();

// --- infrastructure error classifier -----------------------------------------

const INFRASTRUCTURE_PATTERNS = [
    /insufficient.?balance/i,
    /rate.?limit/i,
    /quota.?exceeded/i,
    /payment.?required/i,
    /402/,
    /429/,
    /503/,
    /network.?error/i,
    /ECONNREFUSED/,
    /ETIMEDOUT/,
];

const isInfrastructureError = (err: unknown): boolean => {
    const msg = String((err as any)?.message ?? err);
    return INFRASTRUCTURE_PATTERNS.some((p) => p.test(msg));
};

// --- providers ----------------------------------------------------------------

type ProviderCase = {
    id: ProviderId;
    instance: GeminiProvider | OpenrouterProvider;
    envName: string;
    testModel: string;
    deprecatedModel: string;
};

const providers: ProviderCase[] = [
    {
        id: "google",
        instance: new GeminiProvider(process.env.GOOGLE_AI_API ?? ""),
        envName: "GOOGLE_AI_API",
        testModel: "gemini-3.6-flash",
        deprecatedModel: "gemini-2.0-flash",
    },
    {
        id: "openrouter",
        instance: new OpenrouterProvider(
            process.env.OPENROUTER_AI_API ?? process.env.OPENROUETER_AI_API ?? ""
        ),
        envName: "OPENROUTER_AI_API",
        testModel: "openai/gpt-4o-mini",
        deprecatedModel: "ai21/jamba-large-1.7",
    },
];

// --- generateReply ------------------------------------------------------------

providers.forEach(({ id, instance, envName, testModel }) => {
    test(`generateReply returns non-empty string � ${id}`, async (t) => {
        if (!process.env[envName]) throw new Error(`${envName} is not set`);

        let reply: string;

        try {
            reply = await instance.generateReply(
                [{ role: "user", content: "say hello", timestamp: Date.now() }],
                testModel
            );
        } catch (err: unknown) {
            if (isInfrastructureError(err)) {
                t.skip(`infrastructure issue � ${(err as any)?.message ?? err}`);
                return;
            }
            throw err;
        }

        assert.ok(reply && reply.length > 0, "expected non-empty reply from provider");
    });
});

// --- generateReply: deprecated model -> ModelUnavailableError ----------------

providers.forEach(({ id, instance, envName, deprecatedModel }) => {
    test(`generateReply with deprecated model throws ModelUnavailableError — ${id}`, async (t) => {
        if (!process.env[envName]) throw new Error(`${envName} is not set`);

        try {
            await assert.rejects(
                () => instance.generateReply(
                    [{ role: "user", content: "say hello", timestamp: Date.now() }],
                    deprecatedModel
                ),
                ModelUnavailableError
            );
        } catch (err: unknown) {
            if (isInfrastructureError(err)) {
                t.skip(`infrastructure issue — ${(err as any)?.message ?? err}`);
                return;
            }
            throw err;
        }
    });
});

// --- generateReply: unknown model name -> generic Error ----------------------

providers.forEach(({ id, instance }) => {
    test(`generateReply with unknown model throws Error — ${id}`, async () => {
        await assert.rejects(
            () => instance.generateReply(
                [{ role: "user", content: "say hello", timestamp: Date.now() }],
                "xyz-fake-model-99999"
            ),
            (err: unknown) => {
                assert.ok(err instanceof Error, "expected an Error to be thrown");
                assert.ok(
                    !(err instanceof ModelUnavailableError),
                    "unknown model should not classify as ModelUnavailableError"
                );
                return true;
            }
        );
    });
});
