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

  it("refuses the resize, before writing the design, when a sibling's support would not fit", async () => {
    useDesignerStore.setState({ currentDesignId: null });
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
    registerLinkedSlantResolver(null);
    unmount();
  });
});
