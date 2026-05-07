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
  };
}

async function firePageHide(): Promise<void> {
  window.dispatchEvent(new Event('pagehide'));
  // The handler is async; let microtasks settle.
  await new Promise((r) => setTimeout(r, 10));
}

describe('useBeaconFlush', () => {
  it('sends a beacon for each pending PUT', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'put', modifiedAt: 1000 },
      { kind: 'designs', id: 'des-1', op: 'put', modifiedAt: 2000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    await firePageHide();

    expect(sendBeaconMock).toHaveBeenCalledTimes(2);
    expect(sendBeaconMock).toHaveBeenCalledWith('/api/sync/layouts/lay-1', expect.any(Blob));
    expect(sendBeaconMock).toHaveBeenCalledWith('/api/sync/designs/des-1', expect.any(Blob));
  });

  it('skips DELETE entries (sendBeacon is POST-shaped)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'delete', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    await firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('skips entries whose payload exceeds the beacon size budget', async () => {
    const huge = { large: 'x'.repeat(100_000) };
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'too-big', op: 'put', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters(huge)));
    await firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('skips entries whose adapter.get returns null (item was deleted between enqueue and pagehide)', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'gone', op: 'put', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters(null)));
    await firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('removes the pagehide listener on unmount', async () => {
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'put', modifiedAt: 1000 },
    ]);
    const { unmount } = renderHook(() => useBeaconFlush(makeAdapters()));
    unmount();
    await firePageHide();
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });
});
