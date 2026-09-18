import test, { mock } from 'node:test';
import assert from 'node:assert';
import { JsonProviderAuthStorage } from '@locochat/storage';
import { resetProviders } from '@locochat/core';
import {
    initProviders,
    handleGetSupportedProviders,
    handleGetConnectedProviders,
    handleConnectProvider
} from '../../../../../clients/electron/ipc/providerHandlers.js';

test('providerHandlers IPC logic', async (t) => {
    t.afterEach(() => {
        mock.restoreAll();
        resetProviders(); // clear in-memory core state
    });

    await t.test('initProviders queries storage', async () => {
        const loadAllMock = mock.method(JsonProviderAuthStorage.prototype, 'loadAll', async () => []);
        await initProviders();
        assert.strictEqual(loadAllMock.mock.callCount(), 1);
    });

    await t.test('handleGetSupportedProviders returns provider list', async () => {
        const res = await handleGetSupportedProviders();
        assert.ok(Array.isArray(res));
        assert.ok(res.includes('google'));
    });

    await t.test('handleGetConnectedProviders returns empty array initially', async () => {
        const res = await handleGetConnectedProviders();
        assert.deepStrictEqual(res, []);
    });

    await t.test('handleConnectProvider saves and activates provider', async () => {
        // Mock global fetch so provider.validateApiKey() succeeds instantly
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mock.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as any);

        const saveMock = mock.method(JsonProviderAuthStorage.prototype, 'save', async () => {});

        await handleConnectProvider('google', 'test-key');
        
        assert.strictEqual(saveMock.mock.callCount(), 1);
        const args = saveMock.mock.calls[0].arguments;
        assert.strictEqual(args[0], 'google');
        assert.strictEqual(args[1], 'test-key');

        const active = await handleGetConnectedProviders();
        assert.deepStrictEqual(active, ['google']);

        globalThis.fetch = originalFetch;
    });
});
