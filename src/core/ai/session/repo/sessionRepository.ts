import type { AppMessage } from "../../providers/types.js";

export type SessionData = {
    sessionId: string;
    messages: AppMessage[];
    providerId: string;
    modelId: string;
    createdAt: number;
};

export interface SessionRepository {
    save(sessionData: SessionData): Promise<void>;
    load(sessionId: string): Promise<SessionData | null>;
    list(): Promise<string[]>;
}
