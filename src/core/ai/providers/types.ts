import type { GlobalConversation } from "../../../types/globalConversationTypes.js"


export interface AiProvider {
  id: string,
  validateApiKey(): Promise<boolean>,
  listModels(): string[]
  generateReply(converstaion: GlobalConversation, model: string): Promise<string | undefined>
}

