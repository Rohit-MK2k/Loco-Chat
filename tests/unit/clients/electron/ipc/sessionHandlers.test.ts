import test, { mock } from 'node:test';
import assert from 'node:assert';
import { Session } from '@locochat/core';
import { JsonSessionStore } from '@locochat/storage';

// Since node:test doesn't have a global module mock system like Jest, 
// if 'electron' import fails in this file, we might need a workaround. 
// Let's see if tsx runs it.
import {
    handleSessionList,
    handleSessionLoad,
    handleSendMessage,
    handleSessionUnload,
    handleGetAvailableModels,
    handleSelectModel
} from '../../../../../clients/electron/ipc/sessionHandlers.js';

test('handleSessionList returns data from store', async (t) => {
    t.afterEach(() => mock.restoreAll());

    mock.method(JsonSessionStore.prototype, 'list', async () => ['id-1', 'id-2']);
    
    const list = await handleSessionList();
    assert.deepStrictEqual(list, ['id-1', 'id-2']);
});

test('handleSessionLoad manages active sessions map', async (t) => {
    t.afterEach(() => mock.restoreAll());
    
    // ensure clear state
    await handleSessionUnload('test-id');

    const restoreMock = mock.method(Session, 'restore', async (id: string) => {
        return { sessionId: id, title: 'Mock' } as any;
    });

    // 1. Missing session triggers restore
    await handleSessionLoad('test-id');
    assert.strictEqual(restoreMock.mock.callCount(), 1);

    // 2. Existing session skips restore
    await handleSessionLoad('test-id');
    assert.strictEqual(restoreMock.mock.callCount(), 1);
});

test('handleSendMessage routes text and chunks to the correct session', async (t) => {
    t.afterEach(() => mock.restoreAll());

    await handleSessionUnload('send-id');
    
    await assert.rejects(
        () => handleSendMessage('send-id', 'hello', () => {}),
        /Session not loaded: send-id/
    );

    const dummySession = {
        sessionId: 'send-id',
        sendMessage: async (text: string, onChunk: any) => {
            onChunk('chunk1');
            return 'reply';
        }
    } as any;

    mock.method(Session, 'restore', async () => dummySession);
    
    await handleSessionLoad('send-id');

    let chunkReceived = '';
    const reply = await handleSendMessage('send-id', 'hello', (chunk) => {
        chunkReceived = chunk;
    });

    assert.strictEqual(chunkReceived, 'chunk1');
    assert.strictEqual(reply, 'reply');
});

test('handleSessionUnload evicts session from tracker', async (t) => {
    t.afterEach(() => mock.restoreAll());
    
    const dummySession = { sessionId: 'unload-id' } as any;
    mock.method(Session, 'restore', async () => dummySession);
    
    await handleSessionLoad('unload-id');
    await handleSessionUnload('unload-id');
    
    await assert.rejects(
        () => handleSendMessage('unload-id', 'hello', () => {}),
        /Session not loaded: unload-id/
    );
});

test('handleGetAvailableModels routes to session', async (t) => {
    t.afterEach(() => mock.restoreAll());

    await handleSessionUnload('models-id');

    const dummySession = {
        sessionId: 'models-id',
        getAvailableModels: async () => ({ google: ['gemini-pro'] })
    } as any;
    
    mock.method(Session, 'restore', async () => dummySession);
    await handleSessionLoad('models-id');

    const models = await handleGetAvailableModels('models-id');
    assert.deepStrictEqual(models, { google: ['gemini-pro'] });
});

test('handleSelectModel routes to session', async (t) => {
    t.afterEach(() => mock.restoreAll());

    await handleSessionUnload('select-id');

    let selectedProvider = '';
    let selectedModel = '';

    const dummySession = {
        sessionId: 'select-id',
        selectModel: async (pId: string, mId: string) => {
            selectedProvider = pId;
            selectedModel = mId;
        }
    } as any;
    
    mock.method(Session, 'restore', async () => dummySession);
    await handleSessionLoad('select-id');

    await handleSelectModel('select-id', 'google', 'gemini-pro');
    
    assert.strictEqual(selectedProvider, 'google');
    assert.strictEqual(selectedModel, 'gemini-pro');
});
