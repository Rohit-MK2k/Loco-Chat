import { googleProvider } from '@earendil-works/pi-ai/providers/google';
import { BasePiAiProvider } from './BasePiAiProvider.js';

export class GeminiProvider extends BasePiAiProvider {
    public id = 'google';

    constructor(apiKey: string) {
        super(apiKey, googleProvider);
    }

    validateApiKey = async (): Promise<boolean> => {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            return res.ok;
        } catch {
            return false;
        }
    }

    listModels = async (): Promise<string[]> => {
        const models = this.modelsCollection.getModels(this.id);
        return models.map((m: any) => m.id);
    }
}