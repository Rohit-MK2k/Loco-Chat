import type { ProviderId } from "./types.js";

export class ModelUnavailableError extends Error {
    constructor(
        public readonly providerId: ProviderId,
        public readonly modelId: string,
        public readonly suggestedModel: string | undefined,
        rawMessage?: string
    ) {
        super(rawMessage ?? `Model "${modelId}" is no longer available on ${providerId}`);
        this.name = "ModelUnavailableError";
    }
}

// Patterns that indicate the model itself is the problem — not auth, not
// network, not rate limit. These are upstream deprecations, API-type
// restrictions, or missing routing endpoints.
const MODEL_UNAVAILABLE_PATTERNS: RegExp[] = [
    /no longer available/i,
    /only supports interactions api/i,
    /no endpoints found/i,
];

// Google includes a suggested replacement in the 404 body:
// "Please update your code to use models/gemini-3.6-flash"
const SUGGESTED_MODEL_PATTERN = /use models\/([^\s",]+)/i;

/**
 * Inspects a raw upstream error message and returns a `ModelUnavailableError`
 * when the message indicates the model is deprecated or unreachable.
 * Returns `null` for all other errors so the caller can re-throw as a generic.
 */
export function classifyProviderError(
    providerId: ProviderId,
    modelId: string,
    rawMessage: string
): ModelUnavailableError | null {
    const isUnavailable = MODEL_UNAVAILABLE_PATTERNS.some((p) => p.test(rawMessage));
    if (!isUnavailable) return null;

    const match = rawMessage.match(SUGGESTED_MODEL_PATTERN);
    const suggestedModel = match?.[1];

    return new ModelUnavailableError(providerId, modelId, suggestedModel, rawMessage);
}
