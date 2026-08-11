import { getActiveProvider } from "../providers/states/connectedProviders.js";
import { getSelectedProviderId, listSelectedProviderModels } from "../providers/states/activeSelection.js";
import type { AppMessage } from "../providers/types.js";

type ModelSelection = {
    providerId: string,
    model: string
}

export class Session {
    private conversation: AppMessage[] = []
    private modelSelection: ModelSelection | null = null

    selectModel = async (model: string) => {
        const providerId = getSelectedProviderId()
        const availableModels = await listSelectedProviderModels()
        
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

        this.conversation.push({ role: "user", content: text })

        const { provider } = getActiveProvider(currentProviderId)
        const reply = await provider.generateReply(this.conversation, this.modelSelection.model)

        if (reply) {
            this.conversation.push({ role: "assistant", content: reply })
        }
        return reply
    }
}
