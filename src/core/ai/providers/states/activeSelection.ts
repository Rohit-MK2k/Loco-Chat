import { getActiveProvider, getActiveProvidersId } from "./connectedProviders.js";

let selectedProviderId: string | null = null

export const selectProvider = (providerId: string): void => {
    const connectedIds = getActiveProvidersId()
    if (!connectedIds.includes(providerId)) {
        throw new Error(`Provider not connected: ${providerId}`)
    }
    selectedProviderId = providerId
}

const listModelsbyProviderId= async (providerId: string): Promise<string[]> => {
    return await getActiveProvider(providerId).provider.listModels()
}

export const getSelectedProviderId = (): string => {
    if (!selectedProviderId) throw new Error("No provider selected")
    return selectedProviderId
}

export const listSelectedProviderModels = async (): Promise<string[]> => {
    return await listModelsbyProviderId(getSelectedProviderId())
}







// export class ActiveProviderState{
//     private selectedProviderAndModel: Record<string, string>
//     private activeProviderList: string[]

//     constructor(){
//         this.activeProviderList = getActiveProvidersId()
//     }

    

// }