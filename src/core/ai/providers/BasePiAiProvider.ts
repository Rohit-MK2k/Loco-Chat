import { createModels, type Context, type Message, type Provider } from '@earendil-works/pi-ai';
import type { AiProvider, AppMessage } from './types.js';

type ProviderFactory = () => Provider

export abstract class BasePiAiProvider implements AiProvider {
    public abstract id: string;
    protected apiKey: string;
    protected modelsCollection;

    constructor(apiKey: string, providerFactory: ProviderFactory) {
        this.apiKey = apiKey;
        this.modelsCollection = createModels();
        this.modelsCollection.setProvider(providerFactory());
    }

    abstract validateApiKey(): Promise<boolean>;
    abstract listModels(): Promise<string[]>;

    generateReply = async (messages: AppMessage[], modelId: string): Promise<string | undefined> => {
        const model = this.modelsCollection.getModel(this.id, modelId);
        if (!model) throw new Error(`Model ${modelId} not found for provider ${this.id}`);

        const piContext: Context = {
            messages: messages.map((msg): Message => {
                if (msg.role === "user") {
                    return {
                        role: "user",
                        content: msg.content,
                        timestamp: Date.now()
                    };
                } else {
                    // We bypass TypeScript's strict AssistantMessage type since 
                    // the provider APIs only actually care about role and content
                    return {
                        role: "assistant",
                        content: [{ type: "text", text: msg.content }],
                        timestamp: Date.now()
                    } as any;
                }
            })
        };

        const response = await this.modelsCollection.complete(model, piContext, { apiKey: this.apiKey });
        return response.content.find((block) => block.type === "text")?.text;
    }
}
