import type { AppMessage } from "../providers/types.js";

export type Conversation = {
    sessionId: string;
    messages: AppMessage[];
    providerId: string;
    modelId: string;
    createdAt: number;
};

export interface ConversationRepository {
    save(conversation: Conversation): Promise<void>;
    load(sessionId: string): Promise<Conversation | null>;
    list(): Promise<string[]>;
}
