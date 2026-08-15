import { getActiveProvider, getActiveProvidersId } from "./connectedProviders.js";

export class ProviderSelection {
    private providerId: string | null = null;
    private modelId: string | null = null;

    async getAvailableModels(): Promise<Record<string, string[]>> {
        const providerIds = getActiveProvidersId();
        const entries = await Promise.all(
            providerIds.map(async (id) => {
                const models = await getActiveProvider(id).provider.listModels();
                return [id, models] as [string, string[]];
            })
        );
        return Object.fromEntries(entries);
    }

    async select(providerId: string, modelId: string): Promise<void> {
        const available = await this.getAvailableModels();
        if (!available[providerId])
            throw new Error(`Provider not connected: ${providerId}`);
        if (!available[providerId].includes(modelId))
            throw new Error(`Model "${modelId}" is not available for provider "${providerId}"`);
        this.providerId = providerId;
        this.modelId = modelId;
    }

    getSelection(): { providerId: string; modelId: string } {
        if (!this.providerId || !this.modelId)
            throw new Error("No provider and model selected");
        return { providerId: this.providerId, modelId: this.modelId };
    }
}
