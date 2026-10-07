import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const maintainMeshFiles = vi.fn(async () => {});
vi.mock('../storage/DesignerStorage', () => ({ maintainMeshFiles }));

const idleCallbacks: (() => void)[] = [];
vi.mock('@/shared/utils/idle', () => ({
  scheduleIdleCallback: (callback: () => void) => idleCallbacks.push(callback),
  cancelIdleCallback: vi.fn(),
}));

import { useMeshFileMaintenance } from './useMeshFileMaintenance';

describe('useMeshFileMaintenance', () => {
  it('runs the mesh file upkeep once per page load, when idle', async () => {
    renderHook(() => useMeshFileMaintenance());
    expect(maintainMeshFiles).not.toHaveBeenCalled();

    idleCallbacks.splice(0).forEach((run) => run());
    await waitFor(() => expect(maintainMeshFiles).toHaveBeenCalledTimes(1));

    renderHook(() => useMeshFileMaintenance());
    expect(idleCallbacks).toEqual([]);
  });
});
