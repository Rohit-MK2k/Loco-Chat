import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // We will add more API endpoints here as we build them out
});
