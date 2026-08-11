export type AppMessage = {
    role: "user" | "assistant";
    content: string;
};

export interface AiProvider {
  id: string,
  validateApiKey(): Promise<boolean>,
  listModels(): Promise<string[]>
  generateReply(messages: AppMessage[], model: string): Promise<string | undefined>
}
