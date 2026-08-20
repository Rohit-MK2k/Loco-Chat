import { randomUUID } from "node:crypto";
import { getActiveProvider } from "../providers/states/connectedProviders.js";
import { ProviderSelection } from "../providers/states/providerSelection.js";
import type { AppMessage } from "../providers/types.js";
import type { SessionRepository } from "./repo/sessionRepository.js";

export class Session {
    readonly sessionId: string;
    readonly createdAt: number;
    title: string;
    projectId: string | null;
    private conversation: AppMessage[] = [];
    private providerSelection = new ProviderSelection();

    constructor(
        private store: SessionRepository,
        sessionId?: string,
        createdAt?: number,
        title: string = "New Chat",
        projectId: string | null = null
    ) {
        this.sessionId = sessionId ?? randomUUID();
        this.createdAt = createdAt ?? Date.now();
        this.title = title;
        this.projectId = projectId;
    }

    static async restore(sessionId: string, store: SessionRepository): Promise<Session> {
        const saved = await store.load(sessionId);
        if (!saved) throw new Error(`Session not found: ${sessionId}`);
        const session = new Session(store, sessionId, saved.createdAt, saved.title, saved.projectId);
        session.conversation = saved.messages;
        await session.providerSelection.select(saved.providerId, saved.modelId);
        return session;
    }

    getAvailableModels(): Promise<Record<string, string[]>> {
        return this.providerSelection.getAvailableModels();
    }

    selectModel(providerId: string, modelId: string): Promise<void> {
        return this.providerSelection.select(providerId, modelId);
    }

    async sendMessage(text: string): Promise<string | undefined> {
        const { providerId, modelId } = this.providerSelection.getSelection();

        this.conversation.push({ role: "user", content: text, timestamp: Date.now() });

        const { provider } = getActiveProvider(providerId);
        const reply = await provider.generateReply(this.conversation, modelId);

        if (reply) {
            this.conversation.push({ role: "assistant", content: reply, timestamp: Date.now() });
            await this.store.save({
                sessionId: this.sessionId,
                title: this.title,
                projectId: this.projectId,
                messages: this.conversation,
                providerId,
                modelId,
                createdAt: this.createdAt,
                lastUsedAt: Date.now(),
            });
        }
        return reply;
    }
}
