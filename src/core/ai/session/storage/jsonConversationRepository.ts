import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { SessionData, SessionRepository } from "../repo/sessionRepository.js";

// ponytail: NODE_ENV switch, add explicit config injection if env var isn't enough
const storageDir = process.env.NODE_ENV === "production"
    ? path.join(os.homedir(), ".locoChat", "conversations")
    : path.join(process.cwd(), "data", "conversations");

export class JsonConversationRepository implements SessionRepository {
    async save(conversation: SessionData): Promise<void> {
        await fs.mkdir(storageDir, { recursive: true });
        await fs.writeFile(
            path.join(storageDir, `${conversation.sessionId}.json`),
            JSON.stringify(conversation),
            "utf-8"
        );
    }

    async load(sessionId: string): Promise<SessionData | null> {
        try {
            const raw = await fs.readFile(path.join(storageDir, `${sessionId}.json`), "utf-8");
            return JSON.parse(raw) as SessionData;
        } catch {
            return null;
        }
    }

    async list(): Promise<string[]> {
        try {
            const files = await fs.readdir(storageDir);
            return files.filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
        } catch {
            return [];
        }
    }
}
