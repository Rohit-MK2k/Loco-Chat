import { randomUUID } from "node:crypto";
import { getActiveProvider } from "../providers/states/connectedProviders.js";
import { ProviderSelection } from "../providers/states/providerSelection.js";
import type { AppMessage } from "../providers/types.js";
import type { SessionRepository } from "./repo/sessionRepository.js";

export class Session {
    readonly sessionId: string;
    private conversation: AppMessage[] = [];
    private providerSelection = new ProviderSelection();

    constructor(private store: SessionRepository, sessionId?: string) {
        this.sessionId = sessionId ?? randomUUID();
    }

    static async restore(sessionId: string, store: SessionRepository): Promise<Session> {
        const saved = await store.load(sessionId);
        if (!saved) throw new Error(`Session not found: ${sessionId}`);
        const session = new Session(store, sessionId);
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

        this.conversation.push({ role: "user", content: text });

        const { provider } = getActiveProvider(providerId);
        const reply = await provider.generateReply(this.conversation, modelId);

        if (reply) {
            this.conversation.push({ role: "assistant", content: reply });
            await this.store.save({
                sessionId: this.sessionId,
                messages: this.conversation,
                providerId,
                modelId,
                createdAt: Date.now(),
            });
        }
        return reply;
    }
}
