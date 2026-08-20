import type { AppMessage } from "../../providers/types.js";

export type SessionData = {
    sessionId: string;
    title: string;
    projectId: string | null;
    messages: AppMessage[];
    providerId: string;
    modelId: string;
    createdAt: number;
    lastUsedAt: number;
};

export interface SessionRepository {
    save(sessionData: SessionData): Promise<void>;
    load(sessionId: string): Promise<SessionData | null>;
    list(): Promise<string[]>;
    delete(sessionId: string): Promise<void>;
}
