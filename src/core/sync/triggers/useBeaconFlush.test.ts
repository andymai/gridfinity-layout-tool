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

function fireVisibilityHidden(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function firePageHide(): void {
  window.dispatchEvent(new Event('pagehide'));
}

// Visibility-hidden does async prep; let the IDB read and adapter.get
// promises resolve before pagehide. In real life the gap between the
// two events is typically tens to hundreds of ms.
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

  it('fires sendBeacon synchronously on pagehide — no awaits between the event and the call', async () => {
    // Regression: previous implementation `await`ed `getPendingEntries`
    // and each `adapter.get` after pagehide fired, defeating the whole
    // point of using sendBeacon as an unload-survival mechanism. Now
    // the prep happens on the earlier visibility-hidden event; pagehide
    // is purely synchronous transmission.
    getPendingEntriesMock.mockResolvedValueOnce([
      { kind: 'layouts', id: 'lay-1', op: 'put', modifiedAt: 1000 },
    ]);
    renderHook(() => useBeaconFlush(makeAdapters()));
    fireVisibilityHidden();
    await settlePrep();

    // No `await` after firing pagehide — sendBeacon must have been
    // invoked before this assertion line even runs.
    firePageHide();
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
