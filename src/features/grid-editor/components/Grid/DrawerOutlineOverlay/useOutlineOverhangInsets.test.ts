import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm, gridUnits } from '@/core/types';
import type { DrawerOutline } from '@/core/types';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import { useOutlineOverhangInsets } from './useOutlineOverhangInsets';

// cellSize + gap = 42px per grid unit → px maps 1:1 onto the 42mm grid unit.
const CELL = 41;
const GAP = 1;

/** 4×4u drawer whose shape spans the full extent, so any shift pushes it out. */
const FULL_EXTENT: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 168, y: 0 },
    { x: 168, y: 168 },
    { x: 0, y: 168 },
  ],
};

function setShape(outline: DrawerOutline | undefined, shiftX = 0, shiftY = 0) {
  const layout = createTestLayout();
  useLayoutStore.setState({
    layout: {
      ...layout,
      gridUnitMm: mm(42),
      drawer: {
        ...layout.drawer,
        width: gridUnits(4),
        depth: gridUnits(4),
        outline,
        gridShiftX: mm(shiftX),
        gridShiftY: mm(shiftY),
      },
      baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
    },
  });
}

describe('useOutlineOverhangInsets', () => {
  beforeEach(() => resetAllStores());

  it('reserves nothing without a custom shape', () => {
    setShape(undefined);
    const { result } = renderHook(() => useOutlineOverhangInsets(CELL, GAP));
    expect(result.current).toEqual({ left: 0, top: 0 });
  });

  it('reserves nothing for an unshifted shape that fits its extent', () => {
    setShape(FULL_EXTENT);
    const { result } = renderHook(() => useOutlineOverhangInsets(CELL, GAP));
    expect(result.current).toEqual({ left: 0, top: 0 });
  });

  it('reserves the left gutter when a shift pushes the shape off the grid', () => {
    // +6mm grid shift translates the shape −6mm, past the left edge.
    setShape(FULL_EXTENT, 6, 0);
    const { result } = renderHook(() => useOutlineOverhangInsets(CELL, GAP));
    expect(result.current.left).toBe(6);
    expect(result.current.top).toBe(0);
  });

  it('reserves the top gutter for a negative Y shift', () => {
    // −6mm grid shift translates the shape +6mm, past the top (back) edge.
    setShape(FULL_EXTENT, 0, -6);
    const { result } = renderHook(() => useOutlineOverhangInsets(CELL, GAP));
    expect(result.current.top).toBe(6);
    expect(result.current.left).toBe(0);
  });

  it('reserves nothing for shifts that move the shape inward', () => {
    // The shape spans the extent, so the opposite shifts overflow the far
    // sides — which the scroll container can reach, so nothing is reserved.
    setShape(FULL_EXTENT, -6, 6);
    const { result } = renderHook(() => useOutlineOverhangInsets(CELL, GAP));
    expect(result.current).toEqual({ left: 0, top: 0 });
  });
});
