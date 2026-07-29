import { GeminiProvider } from "./gemini.js";
import { OpenrouterProvider } from "./openrouter.js";
import type { AiProvider } from "./types.js";

type ProviderFactory = (apiKey: string) => AiProvider

const registry: Record<string, ProviderFactory> = {
    google: (apiKey) => new GeminiProvider(apiKey),
    openRouter: (apiKey) => new OpenrouterProvider(apiKey)
}


export const getProvider = (id: string, apiKey: string): AiProvider => {
    const factory = registry[id]
    if (!factory) {
        throw new Error(`Unknown Provider: ${id}`)
    }
    return factory(apiKey)
}

export const ListProviderId = (): string[] =>{
    return Object.keys(registry)
}