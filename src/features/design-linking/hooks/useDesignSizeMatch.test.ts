import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { commandBus, createCqrsMutations } from '@/core/cqrs';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useToastStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import * as MutationsContext from '@/shared/contexts/MutationsContext';
import type { CustomBinRef } from '@/features/bin-designer';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { useDesignSizeMatch } from './useDesignSizeMatch';

vi.mock('@/shared/contexts/MutationsContext', () => ({ useMutations: vi.fn() }));

const DESIGN = designId('design-1');
const design: CustomBinRef = {
  id: DESIGN,
  name: 'Tray',
  width: 3,
  depth: 2,
  height: 3,
  updatedAt: '2026-11-23T00:00:00.000Z',
};

function place(bins: Bin[]): void {
  useLayoutStore.setState({
    layout: createTestLayout({
      drawer: { width: gridUnits(6), depth: gridUnits(4), height: heightUnits(10) },
      bins,
    }),
  });
}

function linked(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({
    id: binId('bin'),
    width: gridUnits(2),
    depth: gridUnits(2),
    height: heightUnits(3),
    linkedDesignId: DESIGN,
    ...overrides,
  });
}

function stored(): Bin | undefined {
  return useLayoutStore.getState().layout.bins.find((b) => b.id === binId('bin'));
}

beforeEach(() => {
  resetAllStores();
  vi.mocked(MutationsContext.useMutations).mockReturnValue(createCqrsMutations(commandBus));
});

describe('useDesignSizeMatch', () => {
  it('is null for a bin at its design size, turned or not', () => {
    const upright = linked({ width: gridUnits(3) });
    const turned = linked({ width: gridUnits(2), depth: gridUnits(3) });
    place([upright]);
    expect(renderHook(() => useDesignSizeMatch(upright, design)).result.current).toBeNull();
    place([turned]);
    expect(renderHook(() => useDesignSizeMatch(turned, design)).result.current).toBeNull();
  });

  it("is null for a knife block's handle rest, whose size is its own", () => {
    const rest = linked({ pairId: 'pair', pairRole: 'rest' });
    place([rest]);
    expect(renderHook(() => useDesignSizeMatch(rest, design)).result.current).toBeNull();
  });

  it('resizes a locked bin to its design and keeps it locked, in one undo step', () => {
    const bin = linked({ locked: true });
    place([bin]);
    const { result } = renderHook(() => useDesignSizeMatch(bin, design));
    expect(result.current).toMatchObject({
      binSize: '2×2×3u',
      designSize: '3×2×3u',
      canResize: true,
    });

    const before = useHistoryStore.getState().past.length;

    act(() => result.current?.resize());

    expect(stored()).toMatchObject({ width: 3, depth: 2, height: 3, locked: true });
    expect(useHistoryStore.getState().past).toHaveLength(before + 1);
  });

  it('cannot resize where the design size has no room either way round', () => {
    const bin = linked({ x: gridUnits(4), y: gridUnits(2) });
    place([bin]);
    expect(renderHook(() => useDesignSizeMatch(bin, design)).result.current?.canResize).toBe(false);
  });

  it('turns the design when only the turned size has room', () => {
    const bin = linked({ x: gridUnits(4) });
    place([bin]);
    const { result } = renderHook(() => useDesignSizeMatch(bin, design));
    expect(result.current).toMatchObject({ designSize: '2×3×3u', canResize: true });
  });

  it('says so when the resize is refused', () => {
    const bin = linked();
    place([
      bin,
      createTestBin({
        id: binId('right'),
        x: gridUnits(2),
        width: gridUnits(1),
        depth: gridUnits(1),
      }),
      createTestBin({
        id: binId('behind'),
        y: gridUnits(2),
        width: gridUnits(1),
        depth: gridUnits(1),
      }),
    ]);
    const { result } = renderHook(() => useDesignSizeMatch(bin, design));
    expect(result.current?.canResize).toBe(false);

    act(() => result.current?.resize());

    expect(stored()).toMatchObject({ width: 2 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('keeps a turned bin turned when only the height differs', () => {
    const bin = linked({ x: gridUnits(4), width: gridUnits(2), depth: gridUnits(3) });
    place([bin]);
    const tall = { ...design, height: 4 };
    const { result } = renderHook(() => useDesignSizeMatch(bin, tall));
    expect(result.current).toMatchObject({ designSize: '2×3×4u', canResize: true });

    act(() => result.current?.resize());

    expect(stored()).toMatchObject({ x: 4, width: 2, depth: 3, height: 4 });
  });

  it('offers the resize to a stashed bin, whatever else the stash holds', () => {
    const bin = linked({ layerId: STAGING_ID, x: gridUnits(5) });
    place([bin, createTestBin({ id: binId('other'), layerId: STAGING_ID, x: gridUnits(5) })]);
    const { result } = renderHook(() => useDesignSizeMatch(bin, design));
    expect(result.current?.canResize).toBe(true);

    act(() => result.current?.resize());

    expect(stored()).toMatchObject({ width: 3, depth: 2, height: 3 });
  });

  it('shows heights to the precision they are stored at', () => {
    const bin = linked({ width: gridUnits(3), height: heightUnits(3.01) });
    place([bin]);
    const { result } = renderHook(() => useDesignSizeMatch(bin, { ...design, height: 3.04 }));
    expect(result.current).toMatchObject({ binSize: '3×2×3.01u', designSize: '3×2×3.04u' });
  });
});
