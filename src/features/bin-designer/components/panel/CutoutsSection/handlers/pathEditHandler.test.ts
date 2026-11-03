import { describe, it, expect, vi } from 'vitest';
import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  dragSource,
  handleVertexEditKeyDown,
  handleVertexEditPointerDown,
  handleVertexEditPointerMove,
  handleVertexEditPointerUp,
} from './pathEditHandler';
import type { VertexEditMode } from './pathEditHandler';
import type { BinBounds, PointerMoveEvent } from './types';
import { rotateAbout } from '@/shared/utils/cutoutOutline';
import type * as outlineSegments from '@/shared/utils/outlineSegments';
import { outlinesTouch } from '@/shared/utils/outlineSegments';

vi.mock('@/shared/utils/outlineSegments', async (importOriginal) => {
  const real = await importOriginal<typeof outlineSegments>();
  return { ...real, outlinesTouch: vi.fn(real.outlinesTouch) };
});

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
    ring: 0,
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
        dragTarget: { type: 'vertex', ring: 0, index: 1 },
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
        dragTarget: { type: 'handle', ring: 0, index: 1, handleType: 'out' },
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
      expect.objectContaining({ dragTarget: { type: 'vertex', ring: 0, index: 1 } })
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
      makeMode({ dragTarget: { type: 'vertex', ring: 0, index: 0 } }),
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
      makeMode({ dragTarget: { type: 'vertex', ring: 0, index: 0 } }),
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
      makeMode({ dragTarget: { type: 'handle', ring: 0, index: 1, handleType: 'out' } }),
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
      makeMode({ dragTarget: { type: 'handle', ring: 0, index: 1, handleType: 'out' } }),
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
      makeMode({ dragTarget: { type: 'handle', ring: 0, index: 1, handleType: 'out' } }),
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

  it('drops the stale preview so pointer-up cannot resurrect deleted vertices', () => {
    // Bailing out of the drag is not enough on its own: the last preview
    // computed against the longer path stays in the map, and pointer-up
    // commits whatever it finds there — putting the removed points back and
    // overwriting whatever shrank the path in the first place.
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    handleVertexEditPointerMove(
      makeMode({ dragTarget: { type: 'handle', ring: 0, index: 9, handleType: 'in' } }),
      at(5, 5),
      makeCutout(),
      BOUNDS,
      noSnap,
      setters
    );
    expect(setters.setPreview).toHaveBeenCalledWith(new Map());
  });

  it('survives a drag target left behind by a shorter path', () => {
    const setters = { setPreview: vi.fn(), setSegmentHover: vi.fn() };
    expect(() =>
      handleVertexEditPointerMove(
        makeMode({ dragTarget: { type: 'handle', ring: 0, index: 9, handleType: 'in' } }),
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
      makeMode({ selectedPointIndex: 0, dragTarget: { type: 'vertex', ring: 0, index: 0 } }),
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

  it('leaves the islands alone when the cutout is not turned', () => {
    const setters = makeSetters();
    const mode = makeMode({ dragTarget: { type: 'vertex', ring: 0, index: 0 } });
    const islanded = { ...makeCutout(), holes: [[point(4, 4), point(6, 4), point(5, 6)]] };
    handleVertexEditPointerMove(mode, at(-4, 0), islanded, BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    handleVertexEditPointerUp(mode, islanded, preview, setters);
    expect(setters.onUpdate.mock.calls[0][1]).not.toHaveProperty('holes');
  });

  it('keeps the vertex selected after the drag', () => {
    const setters = makeSetters();
    handleVertexEditPointerUp(
      makeMode({ selectedPointIndex: 2, dragTarget: { type: 'vertex', ring: 0, index: 2 } }),
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
      makeMode({ dragTarget: { type: 'vertex', ring: 0, index: 1 } }),
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

describe('editing an island', () => {
  // A 40 mm pocket with one island, a 10 mm square in its middle.
  const OUTER = [point(0, 0), point(40, 0), point(40, 40), point(0, 40)];
  const ISLAND = [point(15, 15), point(25, 15), point(25, 25), point(15, 25)];
  const islanded = (): Cutout => ({
    ...makeCutout(OUTER),
    width: 40,
    depth: 40,
    holes: [ISLAND],
  });

  it('picks up an island’s vertex as ring 1', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(25.2, 15.1), islanded(), 1, setters);
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        ring: 1,
        selectedPointIndex: 1,
        dragTarget: { type: 'vertex', ring: 1, index: 1 },
      })
    );
  });

  it('drags the island and commits it without touching the outline or its bounds', () => {
    const setters = makeSetters();
    const mode = makeMode({
      ring: 1,
      selectedPointIndex: 1,
      dragTarget: { type: 'vertex', ring: 1, index: 1 },
    });
    handleVertexEditPointerMove(mode, at(28, 13), islanded(), BOUNDS, noSnap, setters);

    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    const moved = preview.get('p1');
    expect(moved?.path).toBeUndefined();
    expect(moved?.holes?.[0][1]).toMatchObject({ x: 28, y: 13 });

    handleVertexEditPointerUp(mode, islanded(), preview, setters);
    const committed = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(Object.keys(committed)).toEqual(['holes']);
    expect(committed.holes?.[0][1]).toMatchObject({ x: 28, y: 13 });
  });

  it('adds a point on an island’s edge', () => {
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(20, 15.2), islanded(), 1, setters);
    const committed = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(committed.holes?.[0]).toHaveLength(5);
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ ring: 1, selectedPointIndex: 1 })
    );
  });

  it('deletes the selected island point', () => {
    const setters = makeSetters();
    const event = new KeyboardEvent('keydown', { key: 'Delete' });
    handleVertexEditKeyDown(
      event,
      makeMode({ ring: 1, selectedPointIndex: 2 }),
      islanded(),
      setters
    );
    const committed = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(committed.holes?.[0]).toHaveLength(3);
    expect(committed.path).toBeUndefined();
  });

  // The island can go mid-drag: an undo, a remote edit, the pocket check's fix.
  it('drops the preview when the dragged island is gone', () => {
    const setters = makeSetters();
    const mode = makeMode({
      ring: 1,
      selectedPointIndex: 0,
      dragTarget: { type: 'vertex', ring: 1, index: 0 },
    });
    handleVertexEditPointerMove(mode, at(5, 5), makeCutout(OUTER), BOUNDS, noSnap, setters);
    expect(setters.setPreview).toHaveBeenCalledWith(new Map());
  });
});

describe('picking among rings', () => {
  // An island whose corner sits 1.5 mm in from the outline's.
  const OUTER = [point(0, 0), point(40, 0), point(40, 40), point(0, 40)];
  const NEAR = [point(1.5, 1.5), point(10, 1.5), point(10, 10), point(1.5, 10)];
  const cutout = (): Cutout => ({ ...makeCutout(OUTER), width: 40, depth: 40, holes: [NEAR] });

  it('takes the nearest point, whichever ring comes first', () => {
    const setters = makeSetters();
    // Both corners are in reach: the outline's is 1.7 mm away, the island's 0.4 mm.
    handleVertexEditPointerDown(makeMode(), at(1.2, 1.2), cutout(), 3, setters);
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ ring: 1, dragTarget: { type: 'vertex', ring: 1, index: 0 } })
    );
  });

  it('adds a point to a short edge rather than taking its end, when zoomed out', () => {
    // A 5 mm edge: its middle is 2.5 mm from each end, inside a wide pick but
    // past the 2 mm a point is taken within.
    const short = [point(15, 15), point(20, 15), point(20, 25), point(15, 25)];
    const setters = makeSetters();
    handleVertexEditPointerDown(
      makeMode(),
      at(17.5, 15.1),
      { ...cutout(), holes: [short] },
      4,
      setters
    );
    const committed = setters.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(committed.holes?.[0]).toHaveLength(5);
  });

  const SECOND = [point(30, 30), point(35, 30), point(35, 35)];
  const twoIslands = (): Cutout => ({ ...cutout(), holes: [NEAR, SECOND] });
  const draggingFirst = (from: Cutout) =>
    makeMode({
      ring: 1,
      selectedPointIndex: 1,
      dragTarget: { type: 'vertex', ring: 1, index: 1 },
      dragFrom: dragSource(from),
    });

  it('commits nothing when an island went under the drag', () => {
    const setters = makeSetters();
    const mode = draggingFirst(twoIslands());
    handleVertexEditPointerMove(mode, at(12, 2), twoIslands(), BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    handleVertexEditPointerUp(mode, cutout(), preview, setters);
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('commits nothing when another island changed under the drag, its count the same', () => {
    const setters = makeSetters();
    const mode = draggingFirst(twoIslands());
    handleVertexEditPointerMove(mode, at(12, 2), twoIslands(), BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    const reshaped = [point(30, 30), point(36, 30), point(35, 35)];
    handleVertexEditPointerUp(mode, { ...cutout(), holes: [NEAR, reshaped] }, preview, setters);
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('drops the preview rather than move another island when the dragged one goes', () => {
    // With the first island gone, ring 1 names the second.
    const setters = makeSetters();
    const mode = draggingFirst(twoIslands());
    handleVertexEditPointerMove(
      mode,
      at(12, 2),
      { ...cutout(), holes: [SECOND] },
      BOUNDS,
      noSnap,
      setters
    );
    expect(setters.setPreview).toHaveBeenCalledWith(new Map());
  });

  it('ignores Delete mid-drag, and a release after it commits nothing', () => {
    const setters = makeSetters();
    const event = { key: 'Delete', preventDefault: vi.fn() } as unknown as KeyboardEvent;
    handleVertexEditKeyDown(event, draggingFirst(twoIslands()), twoIslands(), setters);
    expect(setters.onUpdate).not.toHaveBeenCalled();

    handleVertexEditPointerUp(
      makeMode({ ring: 1, selectedPointIndex: 1 }),
      twoIslands(),
      new Map([['p1', { holes: [NEAR, SECOND] }]]),
      setters
    );
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('refuses a delete that leaves two straight points', () => {
    const setters = makeSetters();
    const event = { key: 'Delete', preventDefault: vi.fn() } as unknown as KeyboardEvent;
    handleVertexEditKeyDown(
      event,
      makeMode({ selectedPointIndex: 0 }),
      makeCutout([point(0, 0), point(10, 0), point(10, 10)]),
      setters
    );
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('leaves editing on Escape even when the selected ring is gone', () => {
    const setters = makeSetters();
    const event = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent;
    handleVertexEditKeyDown(event, makeMode({ ring: 2 }), makeCutout(), setters);
    expect(setters.setMode).toHaveBeenCalledWith({ type: 'idle' });
  });
});

describe('editing a turned cutout', () => {
  const ISLAND = [point(4, 4), point(6, 4), point(6, 6), point(4, 6)];
  const turned = (): Cutout => ({ ...makeCutout(), rotation: 90, holes: [ISLAND] });

  /** Where a stored point is drawn: turned about the middle of its outline's bounds. */
  const drawn = (c: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>, p: PathPoint): number[] =>
    rotateAbout(p.x, p.y, c.x + c.width / 2, c.y + c.depth / 2, 90);

  it('picks up the point drawn under the pointer', () => {
    // Turned a quarter clockwise, the stored corner (10, 0) is drawn at (0, 0).
    const setters = makeSetters();
    handleVertexEditPointerDown(makeMode(), at(0.1, 0.1), turned(), 1, setters);
    expect(setters.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ dragTarget: { type: 'vertex', ring: 0, index: 1 } })
    );
  });

  it('commits nothing when an island went between the last move and the release', () => {
    const setters = makeSetters();
    const mode = makeMode({
      dragTarget: { type: 'vertex', ring: 0, index: 2 },
      dragFrom: dragSource(turned()),
    });
    handleVertexEditPointerMove(mode, at(14, 0), turned(), BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    handleVertexEditPointerUp(mode, { ...turned(), holes: [] }, preview, setters);
    expect(setters.onUpdate).not.toHaveBeenCalled();
  });

  it('moves the dragged corner to the pointer and leaves every other point where it was', () => {
    const before = turned();
    const setters = makeSetters();
    const mode = makeMode({
      selectedPointIndex: 2,
      dragTarget: { type: 'vertex', ring: 0, index: 2 },
    });
    // Stored (10, 10) is drawn at (10, 0); pull it out to (14, 0).
    handleVertexEditPointerMove(mode, at(14, 0), before, BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    handleVertexEditPointerUp(mode, before, preview, setters);
    const after = { ...before, ...(setters.onUpdate.mock.calls[0][1] as Partial<Cutout>) };

    const outline = (after.path ?? []).map((p) => drawn(after, p));
    const expected = [
      [0, 10],
      [0, 0],
      [14, 0],
      [10, 10],
    ];
    outline.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(expected[i][0]);
      expect(y).toBeCloseTo(expected[i][1]);
    });
    (after.holes?.[0] ?? []).forEach((p, i) => {
      const [x, y] = drawn(after, p);
      const [wx, wy] = drawn(before, ISLAND[i]);
      expect(x).toBeCloseTo(wx);
      expect(y).toBeCloseTo(wy);
    });
  });
});

describe('keeping what the generator cuts', () => {
  const OUTER = [point(0, 0), point(40, 0), point(40, 40), point(0, 40)];
  const TRIANGLE = [point(15, 15), point(25, 15), point(20, 25)];
  const islanded = (holes: PathPoint[][] = [TRIANGLE]): Cutout => ({
    ...makeCutout(OUTER),
    width: 40,
    depth: 40,
    holes,
  });

  function release(cutout: Cutout, ring: number, index: number, to: { x: number; y: number }) {
    const setters = makeSetters();
    const mode = makeMode({
      ring,
      selectedPointIndex: index,
      dragTarget: { type: 'vertex', ring, index },
      dragFrom: dragSource(cutout),
    });
    handleVertexEditPointerMove(mode, at(to.x, to.y), cutout, BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    handleVertexEditPointerUp(mode, cutout, preview, setters);
    return setters.onUpdate;
  }

  it('refuses an island point snapped onto its neighbour, which leaves two points', () => {
    expect(release(islanded(), 1, 1, { x: 15, y: 15 })).not.toHaveBeenCalled();
  });

  it('refuses an island dragged across or out of the outline', () => {
    expect(release(islanded(), 1, 2, { x: 20, y: 45 })).not.toHaveBeenCalled();
  });

  it('refuses an outline edit that cuts across an island', () => {
    expect(release(islanded(), 0, 2, { x: 18, y: 18 })).not.toHaveBeenCalled();
  });

  it('refuses an island dragged onto another', () => {
    const other = [point(28, 28), point(35, 28), point(35, 35)];
    expect(release(islanded([TRIANGLE, other]), 1, 2, { x: 30, y: 31 })).not.toHaveBeenCalled();
  });

  it('still edits an island that was already outside, so it can be brought back', () => {
    const out = [point(45, 15), point(55, 15), point(50, 25)];
    expect(release(islanded([out]), 1, 0, { x: 46, y: 16 })).toHaveBeenCalled();
  });
});

describe('the cost of a release', () => {
  it('checks a dragged island against the outline only, skipping islands far from it', () => {
    // 64 islands, 2 mm squares on a 10 mm grid.
    const islands = Array.from({ length: 64 }, (_, n) => {
      const x = 5 + (n % 8) * 10;
      const y = 5 + Math.floor(n / 8) * 10;
      return [point(x, y), point(x + 2, y), point(x + 2, y + 2), point(x, y + 2)];
    });
    const outline = [point(0, 0), point(90, 0), point(90, 90), point(0, 90)];
    const cutout: Cutout = { ...makeCutout(outline), width: 90, depth: 90, holes: islands };
    const setters = makeSetters();
    const mode = makeMode({
      ring: 1,
      selectedPointIndex: 0,
      dragTarget: { type: 'vertex', ring: 1, index: 0 },
      dragFrom: dragSource(cutout),
    });
    handleVertexEditPointerMove(mode, at(4, 4), cutout, BOUNDS, noSnap, setters);
    const preview = setters.setPreview.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    vi.mocked(outlinesTouch).mockClear();
    handleVertexEditPointerUp(mode, cutout, preview, setters);
    expect(setters.onUpdate).toHaveBeenCalled();
    expect(outlinesTouch).toHaveBeenCalledTimes(1);
  });
});
