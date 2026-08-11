import { googleProvider } from '@earendil-works/pi-ai/providers/google';
import { BasePiAiProvider } from './BasePiAiProvider.js';

export class GeminiProvider extends BasePiAiProvider {
    public id = 'google';

    constructor(apiKey: string) {
        super(apiKey, googleProvider);
    }

    listModels = async (): Promise<string[]> => {
        const models = this.modelsCollection.getModels(this.id);
        return models.map((m: any) => m.id);
    }
}