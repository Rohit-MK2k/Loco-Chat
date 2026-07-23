export type ContentPart = { type: "text"; text: string };

export type UserMessage = { type: "user_input"; content: ContentPart[] }
export type ModelOutputMessage = { type: "model_output"; content: ContentPart[] };
export type Message =
  | UserMessage
  | ModelOutputMessage 

export type Conversation = Message[];



export interface AiProvider {
  id: string,
  listModels(): string[]
  generateReply(converstaion: Conversation, model: string): Promise<string | undefined>
}

