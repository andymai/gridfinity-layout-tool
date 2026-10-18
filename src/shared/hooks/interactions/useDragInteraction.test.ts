import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDragInteraction } from '@/shared/hooks/interactions/useDragInteraction';
import { useInteractionStore } from '@/core/store/interaction';
import { useToastStore } from '@/core/store';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Coord, Layout } from '@/core/types';
import type { InteractionContext } from '@/shared/hooks/interactions/types';

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: { trackMove: vi.fn(), trackLayerMove: vi.fn(), trackBulkCreation: vi.fn() },
}));

const L1 = layerId('layer1');
const coord = (x: number, y: number): Coord => ({ x: gridUnits(x), y: gridUnits(y) });

function context(layout: Layout, updateBin: InteractionContext['updateBin']): InteractionContext {
  return {
    getGridCoords: vi.fn(() => null),
    clampCoords: vi.fn((c: Coord) => c),
    isInBounds: vi.fn(() => true),
    gridRef: { current: null },
    layout,
    activeLayerId: L1,
    activeCategoryId: layout.categories[0].id,
    paintSize: null,
    selectedBinIds: [],
    setInteraction: vi.fn(),
    setDropTarget: vi.fn(),
    setSelectedBin: vi.fn(),
    setSelectedBins: vi.fn(),
    updateBin,
    deleteBin: vi.fn(),
    addBin: vi.fn(),
    execute: (fn: () => void) => fn(),
    activePointerIdRef: { current: null },
    capturedPointerRef: { current: null },
    ctrlKeyRef: { current: false },
  };
}

function drop(bins: Bin[], delta: Coord, updateBin: InteractionContext['updateBin']): void {
  const layout = createTestLayout({
    drawer: { width: gridUnits(6), depth: gridUnits(4), height: heightUnits(20) },
    bins,
  });
  useInteractionStore.setState({
    interaction: {
      type: 'drag',
      binIds: bins.map((b) => b.id),
      startCoord: coord(0, 0),
      currentCoord: delta,
      valid: true,
      isOverGrid: true,
    },
    dropTarget: null,
  });
  const { result } = renderHook(() => useDragInteraction(context(layout, updateBin)));
  result.current.handleUp();
}

beforeEach(() => {
  resetAllStores();
});

describe('useDragInteraction drop', () => {
  // Moving the pair drops the overhang that keeps the left bin upright, and its
  // support would then stand where the right bin has moved.
  it('moves no bin when the group cannot all land', () => {
    const updateBin = vi.fn(() => ({ ok: true as const, value: undefined }));
    const held = createTestBin({
      id: binId('held'),
      height: heightUnits(6),
      slant: { angleDeg: 45, side: 'right', endSupport: true },
      overhang: { left: 0, right: 5, front: 0, back: 0 },
    });
    const beside = createTestBin({ id: binId('beside'), x: gridUnits(1), height: heightUnits(6) });

    drop([held, beside], coord(1, 0), updateBin);

    expect(updateBin).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('moves every bin of a group that lands, the leading one first', () => {
    const updateBin = vi.fn(() => ({ ok: true as const, value: undefined }));
    const back = createTestBin({ id: binId('back'), y: gridUnits(1) });
    const front = createTestBin({ id: binId('front') });

    drop([front, back], coord(0, 1), updateBin);

    expect(updateBin.mock.calls.map((call: unknown[]) => call[0])).toEqual(['back', 'front']);
  });
});
