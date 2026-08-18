import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ProviderAuthRepository, ProviderAuthConfigData } from '../providerAuthRepository.js'

const storageDir = process.env.NODE_ENV === "production"
    ? path.join(os.homedir(), ".locoChat")
    : path.join(process.cwd(), "data");

const authFile = path.join(storageDir, "auth.json");

// ponytail: reads full file for every call — fine for 2-5 providers (<1KB).
// Switch to per-provider files or SQLite if provider count grows large.
const readAll = async (): Promise<Record<string, ProviderAuthConfigData>> => {
    try {
        return JSON.parse(await fs.readFile(authFile, "utf-8"));
    } catch {
        return {};
    }
}

export class JsonProviderAuthStorage implements ProviderAuthRepository {
    async save(providerId: string, apiKey: string): Promise<void> {
        await fs.mkdir(storageDir, { recursive: true });
        const existing = await readAll();
        const now = Date.now();
        existing[providerId] = {
            providerId,
            apiKey,
            activatedAt: existing[providerId]?.activatedAt ?? now,
            updatedAt: now,
        };
        await fs.writeFile(authFile, JSON.stringify(existing, null, 2), "utf-8");
    }

    async load(providerId: string): Promise<ProviderAuthConfigData | null> {
        return (await readAll())[providerId] ?? null;
    }

    async loadAll(): Promise<ProviderAuthConfigData[]> {
        return Object.values(await readAll());
    }

    async list(): Promise<string[]> {
        return Object.keys(await readAll());
    }
}