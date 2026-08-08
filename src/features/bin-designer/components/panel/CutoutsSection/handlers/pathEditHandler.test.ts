import { describe, it, expect, vi } from 'vitest';
import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  handleVertexEditKeyDown,
  handleVertexEditPointerDown,
  handleVertexEditPointerMove,
  handleVertexEditPointerUp,
} from './pathEditHandler';
import type { VertexEditMode } from './pathEditHandler';
import type { BinBounds, PointerMoveEvent } from './types';

function point(x: number, y: number, overrides: Partial<PathPoint> = {}): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false, ...overrides };
}

/** A closed square, four corners, no bezier handles. */
const SQUARE: PathPoint[] = [point(0, 0), point(10, 0), point(10, 10), point(0, 10)];

function makeCutout(path: readonly PathPoint[] = SQUARE): Cutout {
  return {
    id: 'p1',
    shape: 'path',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: [...path],
  };
}

function makeMode(overrides: Partial<VertexEditMode> = {}): VertexEditMode {
  return {
    type: 'vertex-editing',
    cutoutId: 'p1',
    selectedPointIndex: null,
    dragTarget: null,
    ...overrides,
  };
}

function makeSetters() {
  return {
    setMode: vi.fn(),
    setPreview: vi.fn(),
    onUpdate: vi.fn(),
    setSegmentHover: vi.fn(),
  };
}

const BOUNDS: BinBounds = { binWidth: 100, binDepth: 100 };
const noSnap = (v: number): number => v;
const at = (mmX: number, mmY: number, extra: Partial<PointerMoveEvent> = {}): PointerMoveEvent => ({
  mmX,
  mmY,
  ...extra,
});

describe('handleVertexEditPointerDown', () => {
  it('selects and starts dragging the vertex under the cursor', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(10.2, 0.1), makeCutout(), 1, setters);
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedPointIndex: 1,
        dragTarget: { type: 'vertex', index: 1 },
      })
    );
  });

  it('clears any segment hover on every pointer down', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(50, 50), makeCutout(), 1, setters);
    expect(setters.setSegmentHover).toHaveBeenCalledWith(null);
  });

  it('grabs a bezier handle of the selected point', () => {
    const path = [
      point(0, 0),
      point(10, 0, { handleOut: { dx: 3, dy: 0 }, symmetric: true }),
      point(10, 10),
      point(0, 10),
    ];
    const setters = makeSetters();
    handleVertexEditPointerDown(
      makeMode({ selectedPointIndex: 1 }),
      at(13, 0),
      makeCutout(path),
      1,
      setters
    );
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        dragTarget: { type: 'handle', index: 1, handleType: 'out' },
      })
    );
  });

  it('prefers a vertex over a handle when both are in range', () => {
    // The vertex is the thing you grab to move the point; the handle only
    // shapes the curve, so an ambiguous click has to resolve to the vertex.
    const path = [
      point(0, 0),
      point(10, 0, { handleOut: { dx: 0.2, dy: 0 } }),
      point(10, 10),
      point(0, 10),
    ];
    const setters = makeSetters();
    handleVertexEditPointerDown(
      makeMode({ selectedPointIndex: 1 }),
      at(10.1, 0),
      makeCutout(path),
      1,
      setters
    );
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ dragTarget: { type: 'vertex', index: 1 } })
    );
  });

  it('inserts a point when the cursor is over a segment', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(5, 0), makeCutout(), 1, setters);

    const update = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(update.path).toHaveLength(5);
    // Inserted between the two points of the segment it split.
    expect(update.path?.[1]).toEqual(expect.objectContaining({ x: 5, y: 0 }));
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPointIndex: 1, dragTarget: null })
    );
  });

  it('inserts into the closing segment without reordering the path', () => {
    // The wrap-around segment is the one where the "next" index is 0, so an
    // off-by-one here rewrites the wrong point.
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(0, 5), makeCutout(), 1, setters);

    const update = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(update.path).toHaveLength(5);
    // The new point closes the loop, so it lands last, and the original
    // corners keep their order.
    expect(update.path?.[4]).toEqual(expect.objectContaining({ x: 0, y: 5 }));
    expect(update.path?.slice(0, 4).map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
  });

  it('recomputes the cutout bounds from the new path', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(5, 0), makeCutout(), 1, setters);
    const update = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(update).toMatchObject({ x: 0, y: 0, width: 10, depth: 10 });
  });

  it('deselects when the cursor hits nothing', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(
      makeMode({ selectedPointIndex: 2 }),
      at(50, 50),
      makeCutout(),
      1,
      setters
    );
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPointIndex: null, dragTarget: null })
    );
  });

  it.each([
    ['an empty path', [] as PathPoint[]],
    ['no path at all', undefined],
  ])('does nothing for %s', (_label, path) => {
    const setters = makeSetters();
    const cutout = { ...makeCutout(), path } as Cutout;
    expect(() =>
      handleVertexEditPointerDown(makeMode(), at(0, 0), cutout, 1, setters)
    ).not.toThrow();
    expect(setters.setMode).not.toHaveBeenCalled();
  });

  it('survives a selected index left behind by a shorter path', () => {
    // The path can shrink underneath the mode — a remote sync edit, or the
    // shape being regenerated from the params panel — while the index the
    // user last selected still points past its end.
    const setters = makeSetters();
    const mode = makeMode({ selectedPointIndex: 9 });
    expect(() =>
      handleVertexEditPointerDown(mode, at(50, 50), makeCutout(), 1, setters)
    ).not.toThrow();
  });
});

describe('handleVertexEditPointerMove', () => {
  it('reports the hovered segment when not dragging', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(makeMode(), at(5, 0.2), makeCutout(), BOUNDS, noSnap, setters);
    expect(setters.setSegmentHover).toHaveBeenCalledWith(
      expect.objectContaining({ segmentIndex: 0 })
    );
  });

  it('clears the hover when the cursor leaves every segment', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(makeMode(), at(50, 50), makeCutout(), BOUNDS, noSnap, setters);
    expect(setters.setSegmentHover).toHaveBeenCalledWith(null);
  });

  it('drags a vertex through the snap function', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    const snap = (v: number): number => Math.round(v);
    handleVertexEditPointerMove(
      makeMode({ dragTarget: { type: 'vertex', index: 0 } }),
      at(3.4, 7.6),
      makeCutout(),
      BOUNDS,
      snap,
      setters
    );
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(preview.get('p1')?.path?.[0]).toEqual(expect.objectContaining({ x: 3, y: 8 }));
  });

  it('clamps a dragged vertex inside the bin', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(
      makeMode({ dragTarget: { type: 'vertex', index: 0 } }),
      at(-40, 500),
      makeCutout(),
      BOUNDS,
      noSnap,
      setters
    );
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(preview.get('p1')?.path?.[0]).toEqual(expect.objectContaining({ x: 0, y: 100 }));
  });

  it('stores a dragged handle as an offset from its point', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(
      makeMode({ dragTarget: { type: 'handle', index: 1, handleType: 'out' } }),
      at(14, 3),
      makeCutout(),
      BOUNDS,
      noSnap,
      setters
    );
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    // Point 1 is at (10, 0), so the offset is the cursor minus the point.
    expect(preview.get('p1')?.path?.[1].handleOut).toEqual({ dx: 4, dy: 3 });
  });

  it('breaks symmetry when alt is held', () => {
    const path = [
      point(0, 0),
      point(10, 0, { handleIn: { dx: -2, dy: 0 }, handleOut: { dx: 2, dy: 0 }, symmetric: true }),
      point(10, 10),
      point(0, 10),
    ];
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(
      makeMode({ dragTarget: { type: 'handle', index: 1, handleType: 'out' } }),
      at(14, 3, { altKey: true }),
      makeCutout(path),
      BOUNDS,
      noSnap,
      setters
    );
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    const updated = preview.get('p1')?.path?.[1];
    expect(updated?.symmetric).toBe(false);
    // The opposite handle is left exactly where it was.
    expect(updated?.handleIn).toEqual({ dx: -2, dy: 0 });
  });

  it('mirrors the opposite handle when symmetry is on', () => {
    const path = [
      point(0, 0),
      point(10, 0, { handleIn: { dx: -2, dy: 0 }, handleOut: { dx: 2, dy: 0 }, symmetric: true }),
      point(10, 10),
      point(0, 10),
    ];
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(
      makeMode({ dragTarget: { type: 'handle', index: 1, handleType: 'out' } }),
      at(14, 3),
      makeCutout(path),
      BOUNDS,
      noSnap,
      setters
    );
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    const updated = preview.get('p1')?.path?.[1];
    expect(updated?.handleOut).toEqual({ dx: 4, dy: 3 });
    expect(updated?.handleIn).toEqual({ dx: -4, dy: -3 });
  });

  it('survives a drag target left behind by a shorter path', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    expect(() =>
      handleVertexEditPointerMove(
        makeMode({ dragTarget: { type: 'handle', index: 9, handleType: 'in' } }),
        at(5, 5),
        makeCutout(),
        BOUNDS,
        noSnap,
        setters
      )
    ).not.toThrow();
  });
});

describe('handleVertexEditPointerUp', () => {
  it('commits the previewed path and clears the drag', () => {
    const setters = makeSetters();
    // Pulling the corner outward is what moves the bounding box; nudging it
    // inward leaves the other three corners defining the same extent.
    const moved = [point(-4, 0), point(10, 0), point(10, 10), point(0, 10)];
    handleVertexEditPointerUp(
      makeMode({ selectedPointIndex: 0, dragTarget: { type: 'vertex', index: 0 } }),
      makeCutout(),
      new Map([['p1', { path: moved }]]),
      setters
    );
    expect(setters.onUpdate).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ x: -4, y: 0, width: 14, depth: 10 })
    );
    expect(setters.setPreview).toHaveBeenCalledWith(new Map());
    expect(setters.setMode).toHaveBeenCalledWith(expect.objectContaining({ dragTarget: null }));
  });

  it('keeps the vertex selected after the drag', () => {
    const setters = makeSetters();
    handleVertexEditPointerUp(
      makeMode({ selectedPointIndex: 2, dragTarget: { type: 'vertex', index: 2 } }),
      makeCutout(),
      new Map(),
      setters
    );
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPointIndex: 2 })
    );
  });

  it('discards an edit that crosses the path over itself', () => {
    // A self-intersecting outline has no well-defined inside, so it cannot be
    // turned into a solid; the drag snaps back rather than committing.
    const setters = makeSetters();
    const bowtie = [point(0, 0), point(10, 10), point(10, 0), point(0, 10)];
    handleVertexEditPointerUp(
      makeMode({ dragTarget: { type: 'vertex', index: 1 } }),
      makeCutout(),
      new Map([['p1', { path: bowtie }]]),
      setters
    );
    expect(setters.onUpdate).not.toHaveBeenCalled();
    expect(setters.setPreview).toHaveBeenCalledWith(new Map());
  });

  it('does nothing to the cutout when there is no preview', () => {
    const setters = makeSetters();
    handleVertexEditPointerUp(makeMode(), makeCutout(), new Map(), setters);
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });
});

describe('handleVertexEditKeyDown', () => {
  const press = (key: string): KeyboardEvent =>
    ({ key, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

  it.each(['Delete', 'Backspace'])('%s removes the selected vertex', (key) => {
    const setters = makeSetters();
    const five = [...SQUARE, point(5, 5)];
    handleVertexEditKeyDown(
      press(key),
      makeMode({ selectedPointIndex: 4 }),
      makeCutout(five),
      setters
    );
    const update = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(update.path).toHaveLength(4);
  });

  it('refuses to delete below MIN_PATH_POINTS anchors', () => {
    const setters = makeSetters();
    const event = press('Delete');
    handleVertexEditKeyDown(
      event,
      makeMode({ selectedPointIndex: 0 }),
      makeCutout(Array.from({ length: MIN_PATH_POINTS }, (_, i) => point(i * 10, 0))),
      setters
    );
    expect(setters.onUpdate).not.toHaveBeenCalled();
    // The key is left to the browser rather than swallowed for nothing.
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('moves the selection back when the removed vertex was the last', () => {
    // Leaving the index past the end would make the next click read an
    // undefined point.
    const setters = makeSetters();
    const five = [...SQUARE, point(5, 5)];
    handleVertexEditKeyDown(
      press('Delete'),
      makeMode({ selectedPointIndex: 4 }),
      makeCutout(five),
      setters
    );
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPointIndex: 3, dragTarget: null })
    );
  });

  it('writes nothing when the selected index no longer exists', () => {
    // splice() past the end removes nothing, so this committed a path
    // identical to the current one — a history entry that undoes to itself.
    const setters = makeSetters();
    handleVertexEditKeyDown(
      press('Delete'),
      makeMode({ selectedPointIndex: 9 }),
      makeCutout([...SQUARE, point(5, 5)]),
      setters
    );
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when no vertex is selected', () => {
    const setters = makeSetters();
    handleVertexEditKeyDown(
      press('Delete'),
      makeMode(),
      makeCutout([...SQUARE, point(5, 5)]),
      setters
    );
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('Escape leaves vertex editing', () => {
    const setters = makeSetters();
    handleVertexEditKeyDown(
      press('Escape'),
      makeMode({ selectedPointIndex: 1 }),
      makeCutout(),
      setters
    );
    expect(setters.setMode).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('ignores keys it does not handle', () => {
    const setters = makeSetters();
    handleVertexEditKeyDown(press('q'), makeMode({ selectedPointIndex: 1 }), makeCutout(), setters);
    expect(setters.setMode).not.toHaveBeenCalled();
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });
});
