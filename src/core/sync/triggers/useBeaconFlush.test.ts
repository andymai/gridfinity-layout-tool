// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeaconFlush } from './useBeaconFlush';
import type { SyncAdapters } from '../adapters/types';

const getPendingEntriesMock = vi.fn();

vi.mock('../engine', () => ({
  getPendingEntries: () => getPendingEntriesMock(),
}));

const sendBeaconMock = vi.fn(() => true);

beforeEach(() => {
  getPendingEntriesMock.mockReset();
  sendBeaconMock.mockReset();
  sendBeaconMock.mockReturnValue(true);
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: sendBeaconMock,
  });
});

function makeAdapters(layoutPayload: Record<string, unknown> | null = { v: 1 }): SyncAdapters {
  return {
    layouts: {
      list: vi.fn(),
      get: vi.fn(async (id: string) =>
        layoutPayload ? { id, payload: layoutPayload, modifiedAt: 1000 } : null
      ),
      applyRemote: vi.fn(),
      applyRemoteDelete: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    },
    designs: {
      list: vi.fn(),
      get: vi.fn(async (id: string) => ({ id, payload: { d: 1 }, modifiedAt: 2000 })),
      applyRemote: vi.fn(),
      applyRemoteDelete: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    },
    baseplates: {
      list: vi.fn(),
      get: vi.fn(async (id: string) => ({ id, payload: { b: 1 }, modifiedAt: 3000 })),
      applyRemote: vi.fn(),
      applyRemoteDelete: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    },
  };
}

function fireVisibilityHidden(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function firePageHide(): void {
  window.dispatchEvent(new Event('pagehide'));
}

// Let visibility-hidden's IDB read + adapter.get settle before pagehide.
async function settlePrep(): Promise<void> {
  await new Promise((r) => setTimeout(r, 10));
}

describe('useBeaconFlush', () => {
  it('sends a beacon for each pending PUT after the visibility-hidden prep completes', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'put', modifiedAt: 1000 },
      { kind: 'designs', id: 'des-1', op: 'put', modifiedAt: 2000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    fireVisibilityHidden();
    await settlePrep();
    firePageHide();

    expect(sendBeaconMock).toHaveBeenCalledTimes(2);
    expect(sendBeaconMock).toHaveBeenCalledWith('/api/sync/layouts/lay-1', expect.any(Blob));
    expect(sendBeaconMock).toHaveBeenCalledWith('/api/sync/designs/des-1', expect.any(Blob));
  });

  it('wraps a baseplate payload in { baseplate } (not { design })', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'baseplates', id: 'bp-1', op: 'put', modifiedAt: 3000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    fireVisibilityHidden();
    await settlePrep();
    firePageHide();

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
    expect(url).toBe('/api/sync/baseplates/bp-1');
    const body = JSON.parse(await blob.text()) as Record<string, unknown>;
    expect(body).toEqual({ baseplate: { b: 1 }, modifiedAt: 3000 });
  });

  it('fires sendBeacon synchronously on pagehide — no awaits between the event and the call', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'put', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    fireVisibilityHidden();
    await settlePrep();

    firePageHide();
    // No await between firePageHide and this assertion — sendBeacon must have already fired.
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
  });

  it('skips DELETE entries (sendBeacon is POST-shaped)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'delete', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    fireVisibilityHidden();
    await settlePrep();
    firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('skips entries whose payload exceeds the beacon size budget', async () => {
    const huge = { large: 'x'.repeat(100_000) };
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'too-big', op: 'put', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters(huge)));
    fireVisibilityHidden();
    await settlePrep();
    firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('skips entries whose adapter.get returns null (item was deleted between enqueue and pagehide)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'gone', op: 'put', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters(null)));
    fireVisibilityHidden();
    await settlePrep();
    firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('removes the pagehide listener on unmount', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'put', modifiedAt: 1000 },
    ]);
    const { unmount } = renderHook(() => useBeaconFlush(makeAdapters()));
    fireVisibilityHidden();
    await settlePrep();
    unmount();
    firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });
});
