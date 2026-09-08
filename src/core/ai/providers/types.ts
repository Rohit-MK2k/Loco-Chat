export type AppMessage = {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

export type ChunkCallback = (chunk: string) => void;

export interface AiProvider {
  id: string,
  validateApiKey(): Promise<boolean>,
  listModels(): Promise<string[]>
  generateReply(messages: AppMessage[], model: string, onChunk?: ChunkCallback): Promise<string>
}

export type ProviderId = "google" | "openrouter"