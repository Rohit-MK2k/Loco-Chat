import { getProvider } from "./registry.js";
import type { AiProvider } from "./types.js";

type ActiveSelection = {
    providerId: string;
    modelId: string
}

let current: ActiveSelection | null = null // null means nobody picked anything yet

export const setActive = (providerId:string, modelId: string): void => {
    current = {
        providerId,
        modelId
    }
}

export const getActiveProvider = (apiKey: string): AiProvider =>{
    if (current == null){
        throw new Error("no provider selected yet")
    }

    return getProvider(current.providerId, apiKey)
}

export const getActiveModel = (): string =>{
    if (current == null){
        throw new Error("no provider selected yet")
    }

    return current.modelId
}

export const getActiveProviderId = (): string => {
    if (current == null){
        throw new Error("no provider selected yet")
    }

    return current.providerId
}

