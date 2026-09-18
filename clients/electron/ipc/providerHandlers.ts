import {
  initActiveProvider,
  ListProviderId,
  getActiveProvidersId,
  connectAndSaveProvider
} from '@locochat/core';
import { JsonProviderAuthStorage } from '@locochat/storage';
import { IpcMain, IpcMainInvokeEvent } from 'electron';

const store = new JsonProviderAuthStorage();

export async function initProviders() {
  await initActiveProvider(store);
}

export async function handleGetSupportedProviders() {
  return ListProviderId();
}

export async function handleGetConnectedProviders() {
  return getActiveProvidersId();
}

export async function handleConnectProvider(providerId: string, apiKey: string) {
  await connectAndSaveProvider(providerId, apiKey, store);
}

export function registerProviderHandlers(ipcMain: IpcMain) {
  ipcMain.handle('provider:supported', handleGetSupportedProviders);
  ipcMain.handle('provider:connected', handleGetConnectedProviders);
  ipcMain.handle('provider:connect', (_event: IpcMainInvokeEvent, { providerId, apiKey }: { providerId: string, apiKey: string }) => {
    return handleConnectProvider(providerId, apiKey);
  });
}
