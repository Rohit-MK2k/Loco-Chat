import test from "node:test";
import assert from "node:assert";
import { Session } from "../../../../../src/core/ai/session/session.js";
import type { SessionRepository } from "../../../../../src/core/ai/session/repo/sessionRepository.js";

// Unit: no network, no real provider.
// Tests Session's own guard logic using an in-memory null store.

const nullStore: SessionRepository = {
    save: async () => {},
    load: async () => null,
    list: async () => [],
    delete: async () => {},
};

test("Session.restore throws when session not found", async () => {
    await assert.rejects(
        () => Session.restore("non-existent-id", nullStore),
        /Session not found/
    );
});
