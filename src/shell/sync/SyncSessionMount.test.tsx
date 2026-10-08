import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/sync/adapters/layoutAdapter', () => ({ layoutAdapter: {} }));
vi.mock('@/core/sync/adapters/folderAdapter', () => ({ folderAdapter: {} }));
vi.mock('@/features/bin-designer', () => ({ designAdapter: {} }));
vi.mock('@/features/bin-designer/sync/designVersionAdapter', () => ({ designVersionAdapter: {} }));
vi.mock('@/features/baseplate/sync/baseplateAdapter', () => ({ baseplateAdapter: {} }));
vi.mock('@/core/sync/claim', () => ({ runClaim: vi.fn() }));
vi.mock('@/core/sync/engine', () => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('@/core/sync/triggers/useDebouncedPush', () => ({ useDebouncedPush: () => undefined }));
vi.mock('@/core/sync/triggers/useVisibilityFlush', () => ({ useVisibilityFlush: () => undefined }));
vi.mock('@/core/sync/triggers/useBeaconFlush', () => ({ useBeaconFlush: () => undefined }));
vi.mock('@/core/sync/triggers/usePeriodicPoll', () => ({ usePeriodicPoll: () => undefined }));
vi.mock('@/core/sync/useSyncToasts', () => ({ useSyncToasts: () => undefined }));
vi.mock('@/core/sync/session/useSession', async (importOriginal) => ({
  ...(await importOriginal<typeof UseSession>()),
  useSessionLifecycle: () => undefined,
}));
vi.mock('@/shared/generation/meshCloud', () => ({
  beginMeshCloudSession: vi.fn(),
  endMeshCloudSession: vi.fn(),
}));

import { runClaim, type ClaimResult } from '@/core/sync/claim';
import { start, stop } from '@/core/sync/engine';
import { useSessionStore } from '@/core/sync/session/useSession';
import type * as UseSession from '@/core/sync/session/useSession';
import { beginMeshCloudSession, endMeshCloudSession } from '@/shared/generation/meshCloud';
import { SyncSessionMount } from './SyncSessionMount';

const USER = { userId: 'u1', provider: 'google' as const, email: 'a@x', displayName: 'A' };

function claimSettlingLater(): (result: ClaimResult) => void {
  let settle: (result: ClaimResult) => void = () => undefined;
  vi.mocked(runClaim).mockReturnValue(
    new Promise((resolve) => {
      settle = resolve;
    })
  );
  return settle;
}

beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.setState({ status: 'authenticated', user: USER });
});

afterEach(() => {
  cleanup();
  useSessionStore.setState({ status: 'unknown', user: null });
});

describe('SyncSessionMount', () => {
  it('opens the mesh cloud session before the claim pulls anything', () => {
    claimSettlingLater();

    render(<SyncSessionMount />);

    const [opened] = vi.mocked(beginMeshCloudSession).mock.invocationCallOrder;
    const [claimed] = vi.mocked(runClaim).mock.invocationCallOrder;
    expect(opened).toBeLessThan(claimed);
  });

  it('ends the mesh cloud session when sign-out cancels the claim', async () => {
    const settleClaim = claimSettlingLater();
    render(<SyncSessionMount />);
    expect(endMeshCloudSession).not.toHaveBeenCalled();

    act(() => useSessionStore.setState({ status: 'anonymous', user: null }));
    await act(async () => settleClaim({ status: 'merged', pulled: 1, pushed: 0 }));

    expect(endMeshCloudSession).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it('ends the mesh cloud session with the engine once the claim has finished', async () => {
    const settleClaim = claimSettlingLater();
    render(<SyncSessionMount />);
    await act(async () => settleClaim({ status: 'merged', pulled: 0, pushed: 0 }));
    expect(start).toHaveBeenCalledTimes(1);

    act(() => useSessionStore.setState({ status: 'anonymous', user: null }));

    expect(stop).toHaveBeenCalled();
    expect(endMeshCloudSession).toHaveBeenCalledTimes(1);
  });
});
