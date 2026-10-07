import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBinResizedListener } from './useBinResizedListener';
import { useLinkingStore } from '../store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
import * as MutationsContext from '@/shared/contexts/MutationsContext';
import * as UseCustomBins from '@/features/bin-designer/hooks/useCustomBins';
import { binId, designId } from '@/core/types';

vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: vi.fn(),
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
});
