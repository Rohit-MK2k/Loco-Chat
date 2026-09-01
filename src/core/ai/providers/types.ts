export type AppMessage = {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

export interface AiProvider {
  id: string,
  validateApiKey(): Promise<boolean>,
  listModels(): Promise<string[]>
  generateReply(messages: AppMessage[], model: string): Promise<string>
}

export type ProviderId = "google" | "openrouter"