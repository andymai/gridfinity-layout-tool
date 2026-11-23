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
    paintSlant: null,
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

describe('useDragInteraction Alt+drag preview', () => {
  // The original stays where it is, so a copy over it would be dropped by
  // bin.add; the preview must not call that spot valid.
  it('never offers a copy that overlaps its own original', () => {
    const original = createTestBin({
      id: binId('original'),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      drawer: { width: gridUnits(6), depth: gridUnits(4), height: heightUnits(20) },
      bins: [original],
    });
    const ctx = context(
      layout,
      vi.fn(() => ({ ok: true as const, value: undefined }))
    );
    useInteractionStore.setState({
      interaction: {
        type: 'drag',
        binIds: [original.id],
        startCoord: coord(0, 0),
        currentCoord: coord(0, 0),
        valid: true,
        isOverGrid: true,
        duplicate: true,
      },
      dropTarget: null,
    });
    const { result } = renderHook(() => useDragInteraction(ctx));

    result.current.handleMove(coord(1, 0), coord(1, 0));

    const preview = vi.mocked(ctx.setInteraction).mock.lastCall?.[0];
    if (!preview || preview.type !== 'drag') throw new Error('No drag preview');
    const { x, y } = preview.currentCoord;
    const overlapsOriginal = Math.abs(x) < 2 && Math.abs(y) < 2;
    expect(preview.valid && overlapsOriginal).toBe(false);
  });

  it('makes no copy when the pointer never leaves the starting cell', () => {
    const original = createTestBin({
      id: binId('original'),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      drawer: { width: gridUnits(6), depth: gridUnits(4), height: heightUnits(20) },
      bins: [original],
    });
    const ctx = context(
      layout,
      vi.fn(() => ({ ok: true as const, value: undefined }))
    );
    useInteractionStore.setState({
      interaction: {
        type: 'drag',
        binIds: [original.id],
        startCoord: coord(0, 0),
        currentCoord: coord(0, 0),
        valid: true,
        isOverGrid: true,
        duplicate: true,
      },
      dropTarget: null,
    });
    const { result } = renderHook(() => useDragInteraction(ctx));

    result.current.handleMove(coord(0, 0), coord(0, 0));
    const preview = vi.mocked(ctx.setInteraction).mock.lastCall?.[0];
    if (!preview || preview.type !== 'drag') throw new Error('No drag preview');
    expect(preview.currentCoord).toEqual(coord(0, 0));

    useInteractionStore.setState({ interaction: preview });
    result.current.handleUp();
    expect(ctx.addBin).not.toHaveBeenCalled();
  });
});
