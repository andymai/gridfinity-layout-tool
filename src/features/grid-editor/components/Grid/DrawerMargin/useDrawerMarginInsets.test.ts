import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm } from '@/core/types';
import type { DrawerOutline } from '@/core/types';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import { useDrawerMarginInsets } from './useDrawerMarginInsets';

// cellSize + gap = 42px per grid unit → mm map 1:1 against the 42mm grid unit.
const CELL = 41;
const GAP = 1;

function setPadding(overrides: Partial<Record<'left' | 'right' | 'front' | 'back', number>>) {
  const layout = createTestLayout();
  useLayoutStore.setState({
    layout: {
      ...layout,
      gridUnitMm: mm(42),
      baseplateParams: {
        ...DEFAULT_BASEPLATE_PARAMS,
        paddingLeft: mm(overrides.left ?? 0),
        paddingRight: mm(overrides.right ?? 0),
        paddingFront: mm(overrides.front ?? 0),
        paddingBack: mm(overrides.back ?? 0),
      },
    },
  });
}

describe('useDrawerMarginInsets', () => {
  beforeEach(() => resetAllStores());

  it('returns zero insets with no padding', () => {
    setPadding({});
    const { result } = renderHook(() => useDrawerMarginInsets(CELL, GAP));
    expect(result.current).toEqual({ left: 0, right: 0, front: 0, back: 0 });
  });

  it('converts per-side padding (mm) to px at the grid pitch', () => {
    setPadding({ left: 21, front: 42, back: 10.5 });
    const { result } = renderHook(() => useDrawerMarginInsets(CELL, GAP));
    // 42px per unit (=42mm): 21mm → 21px, 42mm → 42px, 10.5mm → 10.5px.
    expect(result.current.left).toBeCloseTo(21, 6);
    expect(result.current.front).toBeCloseTo(42, 6);
    expect(result.current.back).toBeCloseTo(10.5, 6);
    expect(result.current.right).toBe(0);
  });

  it('clamps negative padding to zero', () => {
    setPadding({ left: -5 });
    const { result } = renderHook(() => useDrawerMarginInsets(CELL, GAP));
    expect(result.current.left).toBe(0);
  });

  it('returns zero insets for a shaped drawer (padding is functionally stripped)', () => {
    const layout = createTestLayout();
    const outline: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    useLayoutStore.setState({
      layout: {
        ...layout,
        gridUnitMm: mm(42),
        drawer: { ...layout.drawer, outline },
        baseplateParams: {
          ...DEFAULT_BASEPLATE_PARAMS,
          paddingLeft: mm(21),
          syncWithLayout: true,
        },
      },
    });
    const { result } = renderHook(() => useDrawerMarginInsets(CELL, GAP));
    expect(result.current).toEqual({ left: 0, right: 0, front: 0, back: 0 });
  });
});
