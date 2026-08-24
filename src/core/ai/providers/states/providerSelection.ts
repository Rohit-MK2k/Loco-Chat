import type { ProviderId } from "../types.js";
import { getActiveProvider, getActiveProvidersId } from "./connectedProviders.js";

export class ProviderSelection {
    private providerId: ProviderId | null = null;
    private modelId: string | null = null;
    private cachedModels: Record<ProviderId, string[]> | null = null;

    async getAvailableModels(forceRefresh = false): Promise<Record<ProviderId , string[]>> {
        if (this.cachedModels && !forceRefresh) {
            return this.cachedModels;
        }

        const providerIds = getActiveProvidersId();
        const entries = await Promise.all(
            providerIds.map(async (id) => {
                const models = await getActiveProvider(id).provider.listModels();
                return [id, models] as [ProviderId, string[]];
            })
        );
        this.cachedModels = Object.fromEntries(entries) as Record<ProviderId , string[]>;
        return this.cachedModels;
    }

    async select(providerId: string, modelId: string): Promise<void> {
        const available = await this.getAvailableModels();
        if (!available[providerId as ProviderId])
            throw new Error(`Provider not connected: ${providerId}`);
        if (!available[providerId as ProviderId].includes(modelId))
            throw new Error(`Model "${modelId}" is not available for provider "${providerId}"`);
        // safe: available is keyed by ProviderId, so if it exists the cast is valid
        this.providerId = providerId as ProviderId;
        this.modelId = modelId;
    }

    getSelection(): { providerId: ProviderId; modelId: string } {
        if (!this.providerId || !this.modelId)
            throw new Error("No provider and model selected");
        return { providerId: this.providerId, modelId: this.modelId };
    }
}
