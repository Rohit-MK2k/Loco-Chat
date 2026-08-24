import type { ProviderId } from "../types.js";

export type ProviderAuthConfigData = {
    providerId: string;
    apiKey: string;
    activatedAt: number;
    updatedAt: number;
}

export interface ProviderAuthReader {
    load(providerId: ProviderId): Promise<ProviderAuthConfigData | null>;
    loadAll(): Promise<ProviderAuthConfigData[]>;
    list(): Promise<string[]>;
}

export interface ProviderAuthWriter {
    save(providerId: string, apiKey: string): Promise<void>;
}

// Full read-write — for persistent storage implementations
export interface ProviderAuthRepository extends ProviderAuthReader, ProviderAuthWriter {}
