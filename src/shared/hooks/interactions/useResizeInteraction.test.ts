import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResizeInteraction } from '@/shared/hooks/interactions/useResizeInteraction';
import { useInteractionStore } from '@/core/store/interaction';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { binId, designId, gridUnits, layerId } from '@/core/types';
import type { Bin, BinId, Coord, Layout, Rect } from '@/core/types';
import type { InteractionContext } from '@/shared/hooks/interactions/types';

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: { trackResize: vi.fn(), trackQuickCorrect: vi.fn() },
}));

vi.mock('@/shared/events/syncEventBus', () => ({ emitSyncEvent: vi.fn() }));

const L1 = layerId('layer1');

function context(layout: Layout): InteractionContext {
  return {
    getGridCoords: vi.fn(() => null),
    clampCoords: vi.fn((c: Coord) => c),
    isInBounds: vi.fn(() => true),
    gridRef: { current: null },
    layout,
    activeLayerId: L1,
    activeCategoryId: layout.categories[0].id,
    paintSize: null,
    paintSlant: null,
    selectedBinIds: [],
    setInteraction: vi.fn(),
    setDropTarget: vi.fn(),
    setSelectedBin: vi.fn(),
    setSelectedBins: vi.fn(),
    updateBin: vi.fn(() => ({ ok: true as const, value: undefined })),
    deleteBin: vi.fn(),
    addBin: vi.fn(),
    execute: (fn: () => void) => fn(),
    activePointerIdRef: { current: null },
    capturedPointerRef: { current: null },
    ctrlKeyRef: { current: false },
  };
}

function rect(bin: Bin, width = bin.width): Rect {
  return { x: bin.x, y: bin.y, width, depth: bin.depth };
}

function resizeWider(bins: Bin[]): void {
  const layout = createTestLayout({ bins });
  useInteractionStore.setState({
    interaction: {
      type: 'resize',
      binIds: bins.map((b) => b.id),
      handle: 'e',
      startRects: new Map<BinId, Rect>(bins.map((b) => [b.id, rect(b)])),
      currentRects: new Map<BinId, Rect>(bins.map((b) => [b.id, rect(b, gridUnits(b.width + 1))])),
      valid: true,
    },
  });
  const { result } = renderHook(() => useResizeInteraction(context(layout)));
  result.current.handleUp();
}

beforeEach(() => {
  resetAllStores();
  vi.mocked(emitSyncEvent).mockClear();
});

describe('useResizeInteraction linked resize', () => {
  it('announces the resize of a linked bin to its design', () => {
    const bin = createTestBin({ id: binId('bin'), linkedDesignId: designId('design-1') });

    resizeWider([bin]);

    expect(emitSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bin-resized', binId: 'bin', linkedDesignId: 'design-1' })
    );
  });

  // The rest's footprint is the design's rest part, not the design itself.
  it("does not announce the resize of a knife block's handle rest", () => {
    const rest = createTestBin({
      id: binId('rest'),
      linkedDesignId: designId('design-1'),
      pairId: 'pair',
      pairRole: 'rest',
    });

    resizeWider([rest]);

    expect(emitSyncEvent).not.toHaveBeenCalled();
  });
});
