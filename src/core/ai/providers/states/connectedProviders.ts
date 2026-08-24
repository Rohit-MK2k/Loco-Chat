import type { ProviderAuthReader } from "../repo/providerAuthRepository.js";
import { getProvider, ListProviderId } from "../registry.js";
import type { AiProvider, ProviderId } from "../types.js";

const isProviderId = (id: string): id is ProviderId =>
    (ListProviderId() as string[]).includes(id);


interface ActiveProviderState {
    providerId: ProviderId;
    apiKey: string;
}
type ActiveProviders = ActiveProviderState[]

let currentProviders: ActiveProviders = []

const _checkNullState = () => {
    if (currentProviders.length === 0) {
        throw new Error("no provider selected yet")
    }
}

export const setOneActiveProvider = async (providerId: string, apiKey: string): Promise<void> => {
    if (!isProviderId(providerId)) {
        throw new Error(`Unknown provider: "${providerId}"`)
    }
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

export const getActiveProvider = (providerId: ProviderId): {
    id: ProviderId,
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

export const getActiveProvidersId = ():  ProviderId [] => {
    if (currentProviders.length == 0){
        throw new Error("no provider selected yet")
    }
    return currentProviders.map((provider) => provider.providerId)
}

export const initActiveProvider = async (loader: ProviderAuthReader): Promise<boolean> => {
    const config = await loader.loadAll()
    if (config.length == 0) return false

    const known = config.filter(c => {
        if (!isProviderId(c.providerId)) {
            console.warn(`Skipping unknown provider in storage: "${c.providerId}"`)
            return false
        }
        return true
    }) as ActiveProviders  // safe: isProviderId narrowed providerId to ProviderId

    const skipped = await setAllActiveProviders(known)
    if (skipped.length > 0) {
        console.warn(`Skipped invalid provider keys: ${skipped.join(", ")}`)
    }

    return currentProviders.length > 0
}