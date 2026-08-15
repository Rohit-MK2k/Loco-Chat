import type { AppMessage } from "../providers/types.js";

export type Conversation = {
    sessionId: string;
    messages: AppMessage[];
    createdAt: number;
};

export interface ConversationRepository {
    save(conversation: Conversation): Promise<void>;
    load(sessionId: string): Promise<Conversation | null>;
}
