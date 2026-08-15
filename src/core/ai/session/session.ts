import { getActiveProvider } from "../providers/states/connectedProviders.js";
import { ProviderSelection } from "../providers/states/providerSelection.js";
import type { AppMessage } from "../providers/types.js";

export class Session {
    private conversation: AppMessage[] = [];
    private providerSelection = new ProviderSelection();

    getAvailableModels(): Promise<Record<string, string[]>> {
        return this.providerSelection.getAvailableModels();
    }

    selectModel(providerId: string, modelId: string): Promise<void> {
        return this.providerSelection.select(providerId, modelId);
    }

    async sendMessage(text: string): Promise<string | undefined> {
        const { providerId, modelId } = this.providerSelection.getSelection();

        this.conversation.push({ role: "user", content: text });

        const { provider } = getActiveProvider(providerId);
        const reply = await provider.generateReply(this.conversation, modelId);

        if (reply) this.conversation.push({ role: "assistant", content: reply });
        return reply;
    }
}
