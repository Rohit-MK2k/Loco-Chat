import type { ProviderAuthConfigData, ProviderAuthReader } from "../providerAuthRepository.js"

import * as dotenv from 'dotenv';
dotenv.config();

const envVar: Record<string, string> = {
    google: "GOOGLE_AI_API",
    openRouter: "OPENROUTER_AI_API"
}

export class EnvProviderStore implements ProviderAuthReader {
    async load(providerId: string): Promise<ProviderAuthConfigData | null> {
        const varName = envVar[providerId]
        if (!varName) return null
        const apiKey = process.env[varName]
        if (!apiKey) return null
        return { providerId, apiKey, activatedAt: 0, updatedAt: 0 }
    }

    async loadAll(): Promise<ProviderAuthConfigData[]> {
        const result: ProviderAuthConfigData[] = []
        for (const [providerId, varName] of Object.entries(envVar)) {
            const apiKey = process.env[varName]
            if (apiKey) result.push({ providerId, apiKey, activatedAt: 0, updatedAt: 0 })
        }
        return result
    }

    async list(): Promise<string[]> {
        return Object.entries(envVar)
            .filter(([, varName]) => !!process.env[varName])
            .map(([providerId]) => providerId)
    }
}
