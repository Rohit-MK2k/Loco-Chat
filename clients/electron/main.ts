import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerSessionHandlers } from './ipc/sessionHandlers.js';
import { initProviders, registerProviderHandlers } from './ipc/providerHandlers.js';
import { fileURLToPath } from 'url';
import { isDev } from './utils.js';

// Required for resolving paths when using "type": "module" in package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Electron runs the compiled .js
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (isDev()) {
        // Load the Vite dev server in development
        mainWindow.loadURL('http://localhost:5123');
        mainWindow.webContents.openDevTools();
    } else {
        // Load the static React files in production
        // Go up from clients/electron/dist to clients/ui/dist
        mainWindow.loadFile(path.join(__dirname, '../../ui/dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    await initProviders();
    createWindow();
    registerSessionHandlers(ipcMain);
    registerProviderHandlers(ipcMain);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});