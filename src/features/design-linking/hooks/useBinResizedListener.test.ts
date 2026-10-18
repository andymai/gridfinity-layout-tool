import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBinResizedListener } from './useBinResizedListener';
import { useLinkingStore } from '../store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
import * as MutationsContext from '@/shared/contexts/MutationsContext';
import * as UseCustomBins from '@/features/bin-designer/hooks/useCustomBins';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import { ok } from '@/core/result';
import { useLayoutStore, useToastStore } from '@/core/store';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { loadDesign, updateDesignParams } from '@/features/bin-designer/storage';
import { loadRegistry, upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import type * as StorageModule from '@/features/bin-designer/storage';

vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: vi.fn(),
}));

vi.mock('@/features/bin-designer/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof StorageModule>()),
  loadDesign: vi.fn(),
  updateDesignParams: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useCustomBins', () => ({
  useCustomBins: vi.fn(),
}));

const DESIGN = designId('design-1');

describe('useBinResizedListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MutationsContext.useMutations).mockReturnValue({ updateBin: vi.fn() } as never);
    vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
      { id: DESIGN, name: 'Drawer Bin', width: 2, depth: 2, height: 4, updatedAt: '' },
    ]);
    useLinkingStore.setState({ pendingDesignerUpdated: null });
    useDesignerStore.setState({ currentDesignId: DESIGN, params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('keeps the resized bin with the notice, so Edit Design opens on that placement', () => {
    const { unmount } = renderHook(() => useBinResizedListener());

    emitSyncEvent({
      type: 'bin-resized',
      binId: binId('bin-7'),
      linkedDesignId: DESIGN,
      newDimensions: { width: 3, depth: 2, height: 4 },
    });

    expect(useLinkingStore.getState().pendingDesignerUpdated).toEqual({
      binId: 'bin-7',
      designId: DESIGN,
      designName: 'Drawer Bin',
    });
    unmount();
  });

  it.each([
    ['in storage', null],
    ['open in the designer', DESIGN],
  ])(
    "refuses the resize of a design %s when a sibling's support would not fit",
    async (_where, open) => {
      const setParams = vi.fn();
      useToastStore.setState({ toasts: [] });
      useDesignerStore.setState({ currentDesignId: open, setParams });
      vi.mocked(loadDesign).mockResolvedValue(
        ok({ id: DESIGN, name: 'Pens', params: { ...DEFAULT_BIN_PARAMS } }) as never
      );
      registerLinkedSlantResolver(() => ({
        config: { angleDeg: 45, side: 'back', endSupport: true },
        width: 2,
        depth: 1,
        height: 6,
      }));
      const linked = (id: string, x: number, height: number) =>
        createTestBin({
          id: binId(id),
          x: gridUnits(x),
          width: gridUnits(2),
          height: heightUnits(height),
          linkedDesignId: DESIGN,
        });
      useLayoutStore.setState({
        layout: createTestLayout({
          bins: [
            linked('bin-7', 0, 12),
            linked('sibling', 3, 6),
            createTestBin({
              id: binId('behind'),
              x: gridUnits(3),
              y: gridUnits(2),
              width: gridUnits(2),
            }),
          ],
        }),
      });
      const { unmount } = renderHook(() => useBinResizedListener());

      emitSyncEvent({
        type: 'bin-resized',
        binId: binId('bin-7'),
        linkedDesignId: DESIGN,
        newDimensions: { width: 2, depth: 1, height: 12 },
      });

      await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
      expect(updateDesignParams).not.toHaveBeenCalled();
      expect(setParams).not.toHaveBeenCalled();
      registerLinkedSlantResolver(null);
      unmount();
    }
  );

  it('checks again once the design has saved, and puts it back if a bin took the cells meanwhile', async () => {
    useDesignerStore.setState({ currentDesignId: null });
    useToastStore.setState({ toasts: [] });
    localStorage.clear();
    upsertRegistryEntry({
      id: DESIGN,
      name: 'Pens',
      width: 2,
      depth: 1,
      height: 6,
      updatedAt: 'then',
    });
    registerLinkedSlantResolver(() => ({
      config: { angleDeg: 45, side: 'back', endSupport: true },
      width: 2,
      depth: 1,
      height: 6,
    }));
    const params = { ...DEFAULT_BIN_PARAMS };
    vi.mocked(loadDesign).mockResolvedValue(
      ok({ id: DESIGN, name: 'Pens', updatedAt: 'then', params }) as never
    );
    let finishSave: (result: unknown) => void = () => undefined;
    vi.mocked(updateDesignParams)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishSave = resolve;
        }) as never
      )
      .mockResolvedValue(ok({ id: DESIGN, name: 'Pens', updatedAt: 'now' }) as never);
    const resizedBin = createTestBin({
      id: binId('bin-7'),
      width: gridUnits(2),
      height: heightUnits(12),
      linkedDesignId: DESIGN,
    });
    useLayoutStore.setState({ layout: createTestLayout({ bins: [resizedBin] }) });
    const { unmount } = renderHook(() => useBinResizedListener());

    emitSyncEvent({
      type: 'bin-resized',
      binId: binId('bin-7'),
      linkedDesignId: DESIGN,
      newDimensions: { width: 2, depth: 1, height: 12 },
    });

    await vi.waitFor(() => expect(updateDesignParams).toHaveBeenCalledTimes(1));
    const late = createTestBin({ id: binId('late'), y: gridUnits(2), width: gridUnits(2) });
    useLayoutStore.setState({ layout: createTestLayout({ bins: [resizedBin, late] }) });
    finishSave(ok({ id: DESIGN, name: 'Pens', updatedAt: 'now' }));

    await vi.waitFor(() => expect(updateDesignParams).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateDesignParams).mock.calls[1][1]).toBe(params);
    expect(loadRegistry()[0]).toMatchObject({ height: 6, updatedAt: 'then' });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    registerLinkedSlantResolver(null);
    unmount();
  });
});
