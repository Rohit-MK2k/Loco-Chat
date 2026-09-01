import { createModels, type Context, type Message, type Provider } from '@earendil-works/pi-ai';
import type { AiProvider, AppMessage, ProviderId } from './types.js';
import { classifyProviderError } from './errors.js';

type ProviderFactory = () => Provider

export abstract class BasePiAiProvider implements AiProvider {
    public abstract id: ProviderId;
    protected apiKey: string;
    protected modelsCollection;

    constructor(apiKey: string, providerFactory: ProviderFactory) {
        this.apiKey = apiKey;
        this.modelsCollection = createModels();
        this.modelsCollection.setProvider(providerFactory());
    }

    abstract validateApiKey(): Promise<boolean>;
    abstract listModels(): Promise<string[]>;

    generateReply = async (messages: AppMessage[], modelId: string): Promise<string> => {
        const model = this.modelsCollection.getModel(this.id, modelId);
        if (!model) throw new Error(`Model ${modelId} not found for provider ${this.id}`);

        const piContext: Context = {
            messages: messages.map((msg): Message => {
                if (msg.role === "user") {
                    return {
                        role: "user",
                        content: msg.content,
                        timestamp: msg.timestamp
                    };
                } else {
                    // We bypass TypeScript's strict AssistantMessage type since
                    // the provider APIs only actually care about role and content
                    return {
                        role: "assistant",
                        content: [{ type: "text", text: msg.content }],
                        timestamp: msg.timestamp
                    } as any;
                }
            })
        };

        let response: Awaited<ReturnType<typeof this.modelsCollection.complete>>;
        try {
            response = await this.modelsCollection.complete(model, piContext, { apiKey: this.apiKey });
        } catch (err: unknown) {
            throw new Error(
                `Provider ${this.id} request failed: ${(err as any)?.message ?? err}`
            );
        }

        if (response.stopReason === "error" || response.errorMessage) {
            const rawMessage = response.errorMessage ?? response.stopReason ?? "";
            const classified = classifyProviderError(this.id, modelId, rawMessage);
            if (classified) throw classified;
            throw new Error(`Provider ${this.id} error: ${rawMessage}`);
        }

        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock) {
            throw new Error(`Provider ${this.id} returned no text content`);
        }
        return textBlock.text ?? "";
    }
}
