import { GeminiProvider } from "./gemini.js";
import { OpenrouterProvider } from "./openrouter.js";
import type { AiProvider, ProviderId } from "./types.js";

type ProviderFactory = (apiKey: string) => AiProvider

const registry: Record<ProviderId, ProviderFactory> = {
    google: (apiKey) => new GeminiProvider(apiKey),
    openrouter: (apiKey) => new OpenrouterProvider(apiKey)
}


export const getProvider = (id: ProviderId, apiKey: string): AiProvider => {
    const factory = registry[id]
    if (!factory) {
        throw new Error(`Unknown Provider: ${id}`)
    }
    return factory(apiKey)
}

export const ListProviderId = (): ProviderId[] =>{
    return Object.keys(registry) as ProviderId[]
}