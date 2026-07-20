import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { MAX_MESH_FILE_BYTES } from '@/shared/generation/meshAsset';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { designId } from '@/core/types';
import type { SavedDesign } from '@/features/bin-designer/types';

const importMesh = vi.fn();
vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    acquire: vi.fn(async () => ({ importMesh })),
    release: vi.fn(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const saveDesignMock = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  saveDesign: (input: unknown) => saveDesignMock(input),
}));

const upsertRegistryEntryMock = vi.fn();
vi.mock('@/features/bin-designer/store/customBinRegistry', async (importOriginal) => {
  const original = await importOriginal<object>();
  return {
    ...original,
    upsertRegistryEntry: (ref: unknown) => upsertRegistryEntryMock(ref),
  };
});

const loadDesignMock = vi.fn();
vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: {
    getState: () => ({ loadDesign: loadDesignMock }),
  },
}));

import { useImportBinDesign } from './useImportBinDesign';

// 2×1 lipped 3U bin bounds → detection should claim 2×1×3 with lip.
const asset: MeshAsset = {
  name: 'widget_bin',
  data: 'AAAA',
  triangleCount: 12,
  sizeMm: { x: 83.5, y: 41.5, z: 25.4 },
  outlines: [
    [
      { x: 0, y: 0 },
      { x: 83.5, y: 0 },
      { x: 83.5, y: 41.5 },
    ],
  ],
};

function okOutcome() {
  return {
    ok: true,
    asset,
    positions: new Float32Array(9),
    indices: new Uint32Array(3),
    suggestedCutDepth: 25.4,
    volumeMm3: 25000,
  };
}

function makeFile(size = 100, name = 'widget_bin.stl'): File {
  return new File([new Uint8Array(size)], name, { type: 'model/stl' });
}

describe('useImportBinDesign', () => {
  beforeEach(() => {
    useToastStore.setState(useToastStore.getInitialState());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects oversized files before touching the worker', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useImportBinDesign(onSaved));
    const big = makeFile(10);
    Object.defineProperty(big, 'size', { value: MAX_MESH_FILE_BYTES + 1 });

    act(() => {
      result.current.handleFile(big);
    });

    await waitFor(() => {
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });
    expect(importMesh).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it('runs the worker import and seeds the claim from grid detection', async () => {
    importMesh.mockResolvedValueOnce(okOutcome());
    const { result } = renderHook(() => useImportBinDesign(vi.fn()));

    act(() => {
      result.current.handleFile(makeFile());
    });

    await waitFor(() => {
      expect(result.current.pending).not.toBeNull();
    });
    expect(result.current.claim).toEqual({ width: 2, depth: 1, heightUnits: 3 });
    expect(result.current.pending?.detected.hasLip).toBe(true);
    expect(result.current.pending?.volumeMm3).toBe(25000);
  });

  it('surfaces worker import failures as a toast and clears pending', async () => {
    importMesh.mockResolvedValueOnce({ ok: false, reason: 'not_manifold', message: 'holes' });
    const { result } = renderHook(() => useImportBinDesign(vi.fn()));

    act(() => {
      result.current.handleFile(makeFile());
    });

    await waitFor(() => {
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });
    expect(result.current.pending).toBeNull();
  });

  it('save() persists an importedMesh design with the claimed footprint', async () => {
    importMesh.mockResolvedValueOnce(okOutcome());
    const savedDesign = {
      id: designId('d-new'),
      name: 'widget_bin',
      updatedAt: '2026-07-20T00:00:00.000Z',
    } as SavedDesign;
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useImportBinDesign(onSaved));

    act(() => {
      result.current.handleFile(makeFile());
    });
    await waitFor(() => {
      expect(result.current.pending).not.toBeNull();
    });

    act(() => {
      result.current.setClaim({ width: 2.5, depth: 1, heightUnits: 4 });
    });
    await act(async () => {
      await result.current.save();
    });

    expect(saveDesignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'importedMesh',
        name: 'widget_bin',
        envelope: expect.objectContaining({ width: 2.5, depth: 1 }),
        structure: expect.objectContaining({
          kind: 'importedMesh',
          heightUnits: 4,
          asset,
          volumeMm3: 25000,
          sourceFileName: 'widget_bin.stl',
        }),
      })
    );
    expect(upsertRegistryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd-new',
        kind: 'importedMesh',
        width: 2.5,
        depth: 1,
        height: 4,
      })
    );
    expect(loadDesignMock).toHaveBeenCalledWith(savedDesign);
    expect(onSaved).toHaveBeenCalledWith(savedDesign);
    expect(result.current.pending).toBeNull();
  });

  it('cancel() discards a pending import', async () => {
    importMesh.mockResolvedValueOnce(okOutcome());
    const { result } = renderHook(() => useImportBinDesign(vi.fn()));

    act(() => {
      result.current.handleFile(makeFile());
    });
    await waitFor(() => {
      expect(result.current.pending).not.toBeNull();
    });

    act(() => {
      result.current.cancel();
    });
    expect(result.current.pending).toBeNull();
  });
});
