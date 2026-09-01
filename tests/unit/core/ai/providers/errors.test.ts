import { test } from "node:test";
import assert from "node:assert";
import { ModelUnavailableError, classifyProviderError } from "../../../../../src/core/ai/providers/errors.js";

// --- ModelUnavailableError constructor ---------------------------------------

test("ModelUnavailableError sets name, providerId, modelId, suggestedModel", () => {
    const err = new ModelUnavailableError("google", "gemini-2.0-flash", "gemini-3.6-flash");

    assert.strictEqual(err.name, "ModelUnavailableError");
    assert.strictEqual(err.providerId, "google");
    assert.strictEqual(err.modelId, "gemini-2.0-flash");
    assert.strictEqual(err.suggestedModel, "gemini-3.6-flash");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof ModelUnavailableError);
});

test("ModelUnavailableError uses default message when rawMessage is omitted", () => {
    const err = new ModelUnavailableError("openrouter", "ai21/jamba-large-1.7", undefined);

    assert.ok(err.message.includes("ai21/jamba-large-1.7"));
    assert.ok(err.message.includes("openrouter"));
    assert.strictEqual(err.suggestedModel, undefined);
});

test("ModelUnavailableError uses rawMessage when provided", () => {
    const raw = "No endpoints found for ai21/jamba-large-1.7.";
    const err = new ModelUnavailableError("openrouter", "ai21/jamba-large-1.7", undefined, raw);

    assert.strictEqual(err.message, raw);
});

// --- classifyProviderError ---------------------------------------------------

test("classifyProviderError: Google deprecation — classifies and extracts suggestedModel", () => {
    const raw = `{"error":{"message":"This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.6-flash for the latest features and improvements.","code":404}}`;

    const result = classifyProviderError("google", "gemini-2.0-flash", raw);

    assert.ok(result instanceof ModelUnavailableError);
    assert.strictEqual(result.providerId, "google");
    assert.strictEqual(result.modelId, "gemini-2.0-flash");
    assert.strictEqual(result.suggestedModel, "gemini-3.6-flash");
});

test("classifyProviderError: Google Interactions API only — classifies, no suggestedModel", () => {
    const raw = `{"error":{"message":"This model only supports Interactions API.","code":400}}`;

    const result = classifyProviderError("google", "deep-research-max-preview-04-2026", raw);

    assert.ok(result instanceof ModelUnavailableError);
    assert.strictEqual(result.modelId, "deep-research-max-preview-04-2026");
    assert.strictEqual(result.suggestedModel, undefined);
});

test("classifyProviderError: OpenRouter no endpoints — classifies, no suggestedModel", () => {
    const raw = `404: {"message":"No endpoints found for ai21/jamba-large-1.7.","code":404}`;

    const result = classifyProviderError("openrouter", "ai21/jamba-large-1.7", raw);

    assert.ok(result instanceof ModelUnavailableError);
    assert.strictEqual(result.modelId, "ai21/jamba-large-1.7");
    assert.strictEqual(result.suggestedModel, undefined);
});

test("classifyProviderError: standard provider error — returns null", () => {
    const raw = `{"error":{"message":"API key not valid. Please pass a valid API key.","code":400}}`;

    const result = classifyProviderError("google", "gemini-2.5-flash", raw);

    assert.strictEqual(result, null);
});

test("classifyProviderError: rate limit error — returns null", () => {
    const raw = `{"error":{"message":"Resource has been exhausted (e.g. check quota).","code":429}}`;

    const result = classifyProviderError("google", "gemini-2.5-flash", raw);

    assert.strictEqual(result, null);
});

test("classifyProviderError: empty message — returns null", () => {
    const result = classifyProviderError("google", "gemini-2.5-flash", "");

    assert.strictEqual(result, null);
});
