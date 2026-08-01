import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePenSketch, type Sketch } from './usePenSketch';

const SQUARE: Sketch = {
  verts: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
  radii: [1, 2, 3, 4],
};

const BOUNDS = { widthMm: 100, depthMm: 100, pitchX: 42, pitchY: 42, snap: 0.5 } as const;

function setup(seed: Sketch = SQUARE) {
  return renderHook(() => usePenSketch(seed));
}

// `radii` is a per-index parallel array. Any operation that shifts vertex
// indices without moving it leaves every radius describing a different corner
// than the one it was set on, which is silent — the shape just rounds in the
// wrong places.
describe('usePenSketch radius alignment', () => {
  it('seeds the radii that came with the sketch', () => {
    const { result } = setup();
    expect(result.current.radii).toEqual([1, 2, 3, 4]);
  });

  it('keeps radii with their corners when a corner is inserted', () => {
    const { result } = setup();
    let inserted = -1;
    act(() => {
      inserted = result.current.insertAt(0);
    });
    expect(inserted).toBe(1);
    // The new corner lands between 0 and 1, sharp, and pushes the rest along.
    expect(result.current.radii).toEqual([1, 0, 2, 3, 4]);
    expect(result.current.verts).toHaveLength(5);
  });

  it('keeps radii with their corners when corners are deleted', () => {
    const { result } = setup();
    act(() => result.current.setSelected([1]));
    act(() => result.current.deleteSelected());
    expect(result.current.radii).toEqual([1, 3, 4]);
    expect(result.current.verts).toHaveLength(3);
  });

  it('refuses a delete that would leave less than a triangle', () => {
    const { result } = setup();
    act(() => result.current.setSelected([0, 1]));
    act(() => result.current.deleteSelected());
    expect(result.current.radii).toEqual([1, 2, 3, 4]);
    expect(result.current.verts).toHaveLength(4);
  });

  it('restores both arrays together on undo', () => {
    const { result } = setup();
    act(() => {
      result.current.insertAt(2);
    });
    act(() => result.current.undo());
    expect(result.current.verts).toHaveLength(4);
    expect(result.current.radii).toEqual([1, 2, 3, 4]);
  });

  it('sets the radius of only the given corners', () => {
    const { result } = setup();
    act(() => result.current.setRadii([0, 2], 9));
    expect(result.current.radii).toEqual([9, 2, 9, 4]);
  });

  it('leaves the radii alone when a corner only moves', () => {
    const { result } = setup();
    act(() => result.current.setSelected([0]));
    act(() => result.current.nudge(1, 0, BOUNDS));
    expect(result.current.verts[0].x).toBeGreaterThan(0);
    expect(result.current.radii).toEqual([1, 2, 3, 4]);
  });

  it('clears every radius when reset to a rectangle', () => {
    const { result } = setup();
    act(() => result.current.reset(100, 100));
    expect(result.current.radii).toEqual([0, 0, 0, 0]);
  });

  // insertVertex refuses to split a zero-length segment, so nothing was added
  // and the radii must not shift either.
  it('does not shift radii when a degenerate split is refused', () => {
    const { result } = setup({
      verts: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
      radii: [1, 2, 3, 4],
    });
    act(() => {
      expect(result.current.insertAt(0)).toBe(0);
    });
    expect(result.current.radii).toEqual([1, 2, 3, 4]);
    expect(result.current.verts).toHaveLength(4);
  });
});
