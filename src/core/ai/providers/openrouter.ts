import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import { BasePiAiProvider } from './BasePiAiProvider.js';
import type { ProviderId } from './types.js';

export class OpenrouterProvider extends BasePiAiProvider {
    public id: ProviderId = 'openrouter';

    constructor(apiKey: string) {
        super(apiKey, openrouterProvider);
    }

    validateApiKey = async (): Promise<boolean> => {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
                headers: { Authorization: `Bearer ${this.apiKey}` }
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    listModels = async (): Promise<string[]> => {
        await this.modelsCollection.refresh({ providers: [this.id] });
        const models = this.modelsCollection.getModels(this.id);
        return models.map((m: any) => m.id);
    }
}