export interface ProviderConfig {
    providerId: string,
    apiKey: string
}

// export type ProviderStore = ProviderConfig[]

export interface ProviderConfigLoader {
    loadAll(): Promise<ProviderConfig[]>;
    // saveOne(config:ProviderConfig): void
}