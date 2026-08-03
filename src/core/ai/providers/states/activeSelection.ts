import { getActiveProvider, getActiveProvidersId } from "./connectedProviders.js";

let selectedProviderId: string | null = null

export const selectProvider = (providerId: string): void => {
    const connectedIds = getActiveProvidersId()
    if (!connectedIds.includes(providerId)) {
        throw new Error(`Provider not connected: ${providerId}`)
    }
    selectedProviderId = providerId
}

export const getSelectedProviderId = (): string => {
    if (!selectedProviderId) throw new Error("No provider selected")
    return selectedProviderId
}

export const listSelectedProviderModels = (): string[] => {
    return getActiveProvider(getSelectedProviderId()).provider.listModels()
}