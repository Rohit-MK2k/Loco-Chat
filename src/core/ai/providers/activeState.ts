import type { ProviderConfigLoader } from "./providerStoreTypes.js";
import { getProvider } from "./registry.js";
import type { AiProvider } from "./types.js";

interface ActiveProviderState {
    providerId: string;
    apiKey: string;
}

type ActiveProviders = ActiveProviderState[]

let currentProviders: ActiveProviders = [] // if active provider's len is 0, then nop providers are set

const _checkNullState = () => {
    if (currentProviders.length === 0) {
        throw new Error("no provider selected yet")
    }
}

export const setOneActiveProvider = async (providerId: string, apiKey: string): Promise<void> => {
    const provider = getProvider(providerId, apiKey)
    const valid = await provider.validateApiKey()
    if (!valid) {
        throw new Error(`Invalid API key for provider: ${providerId}`)
    }
    currentProviders.push({ providerId, apiKey })
}

export const setAllActiveProviders = async (providers: ActiveProviders): Promise<string[]> => {
     const checks = await Promise.all(
        providers.map(async (p) => ({
            p,
            valid: await getProvider(p.providerId, p.apiKey).validateApiKey()
        }))
    )
    currentProviders = checks.filter(c => c.valid).map(c => c.p)
    return checks.filter(c => !c.valid).map(c => c.p.providerId)
}

export const getActiveProvider = (providerId: string): {
    id: string,
    provider: AiProvider
} => {
    _checkNullState()

    const activeProvider = currentProviders.find(
        (provider) => provider.providerId === providerId
    )

    if (!activeProvider) {
        throw new Error(`provider not found: ${providerId}`)
    }

    return {
        id: activeProvider.providerId,
        provider: getProvider(activeProvider.providerId, activeProvider.apiKey)
    }
}

export const getActiveProvidersId = (): string[] => {
    if (currentProviders.length == 0){
        throw new Error("no provider selected yet")
    }

    return currentProviders.map((provider) => provider.providerId)
}


export const initActiveProvider = async (loader: ProviderConfigLoader): Promise<boolean> =>{
    const config = await loader.loadAll()
    if (config.length == 0) return false

    const skipped = await setAllActiveProviders(config)
    if (skipped.length > 0) {
        console.warn(`Skipped invalid provider keys: ${skipped.join(", ")}`)
    }

    return currentProviders.length > 0
}
