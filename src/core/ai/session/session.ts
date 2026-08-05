import type { GlobalConversation } from "../../../types/globalConversationTypes.js";
import { getActiveProvider } from "../providers/states/connectedProviders.js";
import { getSelectedProviderId, listSelectedProviderModels } from "../providers/states/activeSelection.js";

type ModelSelection = {
    providerId: string,
    model: string
}


export class Session {
    private conversation: GlobalConversation = []
    private modelSelection: ModelSelection | null = null

    selectModel(model: string): void {
        const providerId = getSelectedProviderId()
        const availableModels = listSelectedProviderModels()

        if (!availableModels.includes(model)){
            throw new Error(`Model "${model}" is not available for the provider "${providerId}"`)
        }

        this.modelSelection = { providerId, model }
    }

    async sendMessage(text:string): Promise<String | undefined> {
        if (!this.modelSelection) {
            throw new Error("No model selected — call selectModel() first")
        }

        const currentProviderId = getSelectedProviderId()
        if (this.modelSelection.providerId !== currentProviderId) {
            throw new Error(
                `Provider changed since model was picked (was ${this.modelSelection.providerId}, now ${currentProviderId}). Re-select a model.`
            )
        }

        this.conversation.push({ type: "user_input", content: [{ type: "text", text }] })

        const { provider } = getActiveProvider(currentProviderId)
        const reply = await provider.generateReply(this.conversation, this.modelSelection.model)

        if (reply) {
            this.conversation.push({ type: "model_output", content: [{ type: "text", text: reply }] })
        }
        return reply
    }
}
