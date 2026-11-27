import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { MeshData } from '@/shared/types/generation';
import { SAMPLE_SOURCE } from '../data/sampleAssets';
import type { YearMesh } from './useYearMeshes';
import { __resetSampleYearForTests, useSampleYear } from './useSampleYear';

const loadSampleMeshes =
  vi.fn<(url: string, triangles: ReadonlyMap<string, number>) => Promise<Map<string, YearMesh>>>();
vi.mock('../utils/sampleMeshes', () => ({
  loadSampleMeshes: (url: string, triangles: ReadonlyMap<string, number>) =>
    loadSampleMeshes(url, triangles),
}));

const knife: YearMesh = { mesh: { triangleCount: 3 } as MeshData, triangles: 5308 };

beforeEach(() => {
  __resetSampleYearForTests();
  loadSampleMeshes.mockReset();
  loadSampleMeshes.mockResolvedValue(new Map([[SAMPLE_SOURCE.longestPrint, knife]]));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSampleYear', () => {
  it('loads nothing until the sample plays', async () => {
    const { result } = renderHook(() => useSampleYear(false));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.data.status).toBe('loading');
    expect(loadSampleMeshes).not.toHaveBeenCalled();
  });

  it('gives the sample stats, the drawer plan and the baked counts', async () => {
    const { result } = renderHook(() => useSampleYear(true));
    await waitFor(() => expect(result.current.data.status).toBe('ready'));
    const { data, drawerPreview, triangles } = result.current;
    if (data.status !== 'ready') return;
    expect(data.stats.type.id).toBe('nightShift');
    expect(data.stats.biggestDrawer?.name).toBe('Workbench');
    expect(drawerPreview?.binMap?.length).toBeGreaterThan(0);
    expect(triangles.get(SAMPLE_SOURCE.longestPrint)).toBeGreaterThan(0);
  });

  it('adds the meshes when they load, once per session', async () => {
    const first = renderHook(() => useSampleYear(true));
    await waitFor(() =>
      expect(first.result.current.meshes.get(SAMPLE_SOURCE.longestPrint)).toBe(knife)
    );
    first.unmount();

    const second = renderHook(() => useSampleYear(true));
    await waitFor(() => expect(second.result.current.meshes.size).toBe(1));
    expect(loadSampleMeshes).toHaveBeenCalledTimes(1);
    expect(loadSampleMeshes.mock.calls[0]?.[0]).toMatch(/meshes\.glb/);
  });

  it('keeps the thumbnails when the meshes fail, and tries again on the next play', async () => {
    loadSampleMeshes.mockRejectedValueOnce(new Error('offline'));
    const first = renderHook(() => useSampleYear(true));
    await waitFor(() => expect(first.result.current.data.status).toBe('ready'));
    await waitFor(() => expect(loadSampleMeshes).toHaveBeenCalledTimes(1));
    expect(first.result.current.meshes.size).toBe(0);
    first.unmount();

    const second = renderHook(() => useSampleYear(true));
    await waitFor(() => expect(second.result.current.meshes.size).toBe(1));
    expect(loadSampleMeshes).toHaveBeenCalledTimes(2);
  });
});
