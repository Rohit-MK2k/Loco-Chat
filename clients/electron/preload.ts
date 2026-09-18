import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
    listSessions: () => ipcRenderer.invoke('session:list'),
    loadSession: (sessionId?: string) => ipcRenderer.invoke('session:load', sessionId),
    unloadSession: (sessionId: string) => ipcRenderer.invoke('session:unload', sessionId),
    sendMessage: (sessionId: string, text: string) => ipcRenderer.invoke('session:sendMessage', { sessionId, text }),
    onMessageChunk: (sessionId: string, callback: (chunk: string) => void) => {
        const channel = `session:chunk:${sessionId}`;
        const handler = (_event: any, chunk: string) => callback(chunk);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    },
    getSupportedProviders: () => ipcRenderer.invoke('provider:supported'),
    getConnectedProviders: () => ipcRenderer.invoke('provider:connected'),
    connectProvider: (providerId: string, apiKey: string) => ipcRenderer.invoke('provider:connect', { providerId, apiKey })
});
