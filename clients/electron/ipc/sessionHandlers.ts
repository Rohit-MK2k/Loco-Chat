import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { Session } from '@locochat/core';
import { JsonSessionStore } from '@locochat/storage';

const store = new JsonSessionStore();
const activeSessions = new Map<string, Session>();

export async function handleSessionList() {
    return await store.list();
}

export async function handleSessionLoad(sessionId: string) {
    if (activeSessions.has(sessionId)) {
        return;
    }
    const session = await Session.restore(sessionId, store);
    activeSessions.set(sessionId, session);
}

export async function handleSendMessage(sessionId: string, text: string, onChunk: (chunk: string) => void) {
    const session = activeSessions.get(sessionId);
    if (!session) {
        throw new Error(`Session not loaded: ${sessionId}`);
    }
    return await session.sendMessage(text, onChunk);
}

export async function handleSessionUnload(sessionId: string) {
    activeSessions.delete(sessionId);
}

export function registerSessionHandlers(ipcMain: IpcMain) {
    ipcMain.handle('session:list', async () => {
        return await handleSessionList();
    });

    ipcMain.handle('session:load', async (_event, sessionId: string) => {
        await handleSessionLoad(sessionId);
    });

    ipcMain.handle('session:sendMessage', async (event: IpcMainInvokeEvent, sessionId: string, text: string) => {
        return await handleSendMessage(sessionId, text, (chunk: string) => {
            event.sender.send(`session:chunk:${sessionId}`, chunk);
        });
    });

    ipcMain.handle('session:unload', async (_event, sessionId: string) => {
        await handleSessionUnload(sessionId);
    });
}
