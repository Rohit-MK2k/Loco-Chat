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

export const setOneActiveProvider = (providerId: string, apiKey: string): void => {
    const provider = {
        providerId,
        apiKey
    }
    currentProviders.push(provider)
}

export const setAllActiveProviders = (providers: ActiveProviders): void => {
    currentProviders = providers
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

    setAllActiveProviders(config)
    return true
}
