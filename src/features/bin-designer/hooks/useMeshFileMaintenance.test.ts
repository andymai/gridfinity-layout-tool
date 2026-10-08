import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const maintainMeshFiles = vi.fn(async () => {});
const refreshMeshFileUse = vi.fn(async () => {});
vi.mock('../storage/DesignerStorage', () => ({ maintainMeshFiles, refreshMeshFileUse }));

const idleCallbacks: (() => void)[] = [];
vi.mock('@/shared/utils/idle', () => ({
  scheduleIdleCallback: (callback: () => void) => idleCallbacks.push(callback),
  cancelIdleCallback: vi.fn(),
}));

import { MESH_USE_RENEW_EVERY_MS, useMeshFileMaintenance } from './useMeshFileMaintenance';

afterEach(() => {
  vi.useRealTimers();
});

describe('useMeshFileMaintenance', () => {
  it('runs the mesh file upkeep once per page load, when idle', async () => {
    renderHook(() => useMeshFileMaintenance());
    expect(maintainMeshFiles).not.toHaveBeenCalled();

    idleCallbacks.splice(0).forEach((run) => run());
    await waitFor(() => expect(maintainMeshFiles).toHaveBeenCalledTimes(1));

    renderHook(() => useMeshFileMaintenance());
    expect(idleCallbacks).toEqual([]);
  });

  it('renews the use of held mesh files for as long as the page stays open', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useMeshFileMaintenance());

    await vi.advanceTimersByTimeAsync(MESH_USE_RENEW_EVERY_MS * 2);
    expect(refreshMeshFileUse).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(MESH_USE_RENEW_EVERY_MS);
    expect(refreshMeshFileUse).toHaveBeenCalledTimes(2);
  });
});
