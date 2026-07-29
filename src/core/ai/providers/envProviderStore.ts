import type { ProviderConfigLoader, ProviderConfig } from "./providerStoreTypes.js";

import * as dotenv from 'dotenv';
dotenv.config();

const envVar: Record<string, string> = {
    google: "GOOGLE_AI_API",
    openRouter: "OPENROUETER_AI_API"
}

export class envProviderStore implements ProviderConfigLoader {
    async loadAll(): Promise<ProviderConfig[]> {
        let providerStore: ProviderConfig[]  = []
        for (const [key, val] of Object.entries(envVar)){
            const apiKey = process.env[val]
            if (apiKey){
                providerStore.push(
                    {
                        providerId: key,
                        apiKey
                    }
                )
            }
        }
        
        return providerStore
    }
}