// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runDeleteAccount, type DeleteAccountConfirmPrompt } from './deleteAccount';
import type { SyncAdapter, SyncAdapters, SyncableItem } from './adapters/types';

const apiDeleteAccountMock = vi.fn();
const clearOutboxMock = vi.fn();
const stopEngineMock = vi.fn();

vi.mock('./engine', () => ({
  stop: () => stopEngineMock(),
}));

vi.mock('./session/sessionApi', () => ({
  deleteAccount: () => apiDeleteAccountMock(),
}));

vi.mock('./outbox', () => ({
  clearAll: () => clearOutboxMock(),
}));

interface MockAdapter extends SyncAdapter {
  items: Map<string, SyncableItem>;
}

function makeAdapter(): MockAdapter {
  const items = new Map<string, SyncableItem>();
  return {
    items,
    list: vi.fn(async () => Array.from(items.values())),
    get: vi.fn(),
    applyRemote: vi.fn(),
    applyRemoteDelete: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
}

let layouts: MockAdapter;
let designs: MockAdapter;
let baseplates: MockAdapter;
let adapters: SyncAdapters;
const onAnonymous = vi.fn();
const promptConfirm: DeleteAccountConfirmPrompt = vi.fn(async () => 'confirm');
const promptCancel: DeleteAccountConfirmPrompt = vi.fn(async () => 'cancel');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  layouts = makeAdapter();
  designs = makeAdapter();
  baseplates = makeAdapter();
  adapters = { layouts, designs, baseplates };
  apiDeleteAccountMock.mockResolvedValue(undefined);
});

describe('runDeleteAccount', () => {
  it('returns "cancelled" and skips the server call when the user cancels', async () => {
    const result = await runDeleteAccount({
      adapters,
      promptConfirm: promptCancel,
      onAnonymous,
    });
    expect(result.status).toBe('cancelled');
    expect(apiDeleteAccountMock).not.toHaveBeenCalled();
    expect(stopEngineMock).not.toHaveBeenCalled();
    expect(clearOutboxMock).not.toHaveBeenCalled();
    expect(onAnonymous).not.toHaveBeenCalled();
  });

  it('on confirm: stops engine, clears outbox, calls API, clears last-user, flips anonymous', async () => {
    localStorage.setItem('gflt-last-signed-in-user', 'user-1');
    const result = await runDeleteAccount({
      adapters,
      promptConfirm,
      onAnonymous,
    });
    expect(result.status).toBe('deleted');
    expect(stopEngineMock).toHaveBeenCalled();
    expect(clearOutboxMock).toHaveBeenCalled();
    expect(apiDeleteAccountMock).toHaveBeenCalled();
    expect(localStorage.getItem('gflt-last-signed-in-user')).toBe(null);
    expect(onAnonymous).toHaveBeenCalled();
  });

  it('does NOT wipe local items — the user keeps their on-device library', async () => {
    layouts.items.set('a', { id: 'a', payload: {}, modifiedAt: 1000 });
    designs.items.set('d', { id: 'd', payload: {}, modifiedAt: 2000 });
    await runDeleteAccount({ adapters, promptConfirm, onAnonymous });
    expect(layouts.applyRemoteDelete).not.toHaveBeenCalled();
    expect(designs.applyRemoteDelete).not.toHaveBeenCalled();
  });

  it('passes the local item count to the prompt for the confirmation message', async () => {
    layouts.items.set('a', { id: 'a', payload: {}, modifiedAt: 1000 });
    layouts.items.set('b', { id: 'b', payload: {}, modifiedAt: 2000 });
    designs.items.set('d', { id: 'd', payload: {}, modifiedAt: 3000 });
    const spy = vi.fn(async () => 'confirm' as const);
    await runDeleteAccount({ adapters, promptConfirm: spy, onAnonymous });
    expect(spy).toHaveBeenCalledWith({ localCount: 3 });
  });

  it('returns "error" if the server call throws and does NOT flip anonymous', async () => {
    apiDeleteAccountMock.mockRejectedValueOnce(new Error('boom'));
    const result = await runDeleteAccount({ adapters, promptConfirm, onAnonymous });
    expect(result).toEqual({ status: 'error', message: 'boom' });
    expect(onAnonymous).not.toHaveBeenCalled();
  });

  it('engine stop and outbox clear happen BEFORE the server call (race-free)', async () => {
    const order: string[] = [];
    stopEngineMock.mockImplementationOnce(() => {
      order.push('stop');
    });
    clearOutboxMock.mockImplementationOnce(async () => {
      order.push('outbox');
    });
    apiDeleteAccountMock.mockImplementationOnce(async () => {
      order.push('api');
    });
    await runDeleteAccount({ adapters, promptConfirm, onAnonymous });
    expect(order).toEqual(['stop', 'outbox', 'api']);
  });
});
