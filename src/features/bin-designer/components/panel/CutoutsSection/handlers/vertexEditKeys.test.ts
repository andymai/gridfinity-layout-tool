import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { handleVertexEditKeyDown, pointKindUpdate } from './vertexEditKeys';
import type { VertexEditMode } from './pathEditHandler';
import { loadFalloffMm } from './falloffRadiusStorage';
import { toDrawnFrame } from './pathRings';

function point(x: number, y: number, overrides: Partial<PathPoint> = {}): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false, ...overrides };
}

const RING = [point(0, 0), point(10, 0), point(20, 0), point(20, 10), point(0, 10)];

function path(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'p',
    shape: 'path',
    x: 0,
    y: 0,
    width: 20,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: RING,
    ...overrides,
  };
}

function mode(overrides: Partial<VertexEditMode> = {}): VertexEditMode {
  return {
    type: 'vertex-editing',
    cutoutId: 'p',
    ring: 0,
    selectedPointIndex: null,
    dragTarget: null,
    ...overrides,
  };
}

function setters() {
  return { setMode: vi.fn(), setPreview: vi.fn(), onUpdate: vi.fn(), setSegmentHover: vi.fn() };
}

function press(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, preventDefault: vi.fn(), shiftKey: false, ...extra } as unknown as KeyboardEvent;
}

describe('handleVertexEditKeyDown', () => {
  beforeEach(() => localStorage.clear());

  it('deletes every selected point and leaves nothing selected', () => {
    const s = setters();
    handleVertexEditKeyDown(
      press('Delete'),
      mode({ selectedPointIndex: 2, selectedPoints: [1, 2] }),
      path(),
      s
    );
    const update = s.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    expect(update.path?.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [20, 10],
      [0, 10],
    ]);
    expect(s.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPointIndex: null, selectedPoints: undefined })
    );
  });

  it('nudges the selected points with the arrow keys, farther with Shift', () => {
    const s = setters();
    const m = mode({ selectedPointIndex: 2, selectedPoints: [2, 3] });
    handleVertexEditKeyDown(press('ArrowRight'), m, path(), s);
    handleVertexEditKeyDown(press('ArrowUp', { shiftKey: true }), m, path(), s);
    const right = s.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    const up = s.onUpdate.mock.calls[1][1] as Partial<Cutout>;
    expect(right.path?.[2]).toMatchObject({ x: 20.5, y: 0 });
    expect(right.path?.[3]).toMatchObject({ x: 20.5, y: 10 });
    expect(up.path?.[3]).toMatchObject({ x: 20, y: 15 });
  });

  it('nudges a turned path the way it is drawn', () => {
    const s = setters();
    const turned = path({ rotation: 90 });
    handleVertexEditKeyDown(press('ArrowRight'), mode({ selectedPointIndex: 1 }), turned, s);
    const update = s.onUpdate.mock.calls[0][1] as Partial<Cutout>;
    const before = toDrawnFrame(turned, 10, 0);
    const after = toDrawnFrame(turned, update.path?.[1].x ?? NaN, update.path?.[1].y ?? NaN);
    expect(after.x - before.x).toBeCloseTo(0.5, 9);
    expect(after.y - before.y).toBeCloseTo(0, 9);
  });

  it('does nothing to the points with nothing selected', () => {
    const s = setters();
    handleVertexEditKeyDown(press('ArrowLeft'), mode(), path(), s);
    handleVertexEditKeyDown(press('Delete'), mode(), path(), s);
    expect(s.onUpdate).not.toHaveBeenCalled();
  });

  it('keeps the reach of a pull under way', () => {
    const s = setters();
    const pulling = mode({
      falloffMm: 10,
      dragTarget: { type: 'segment', ring: 0, segmentIndex: 0, t: 0.5, startX: 5, startY: 0 },
    });
    handleVertexEditKeyDown(press(']'), pulling, path(), s);
    expect(s.setMode).not.toHaveBeenCalled();
  });

  it('sets the pull radius with [ and ], and keeps it for next time', () => {
    const s = setters();
    handleVertexEditKeyDown(press(']'), mode({ falloffMm: 10 }), path(), s);
    expect(s.setMode).toHaveBeenCalledWith(expect.objectContaining({ falloffMm: 12.5 }));
    expect(loadFalloffMm()).toBe(12.5);
    handleVertexEditKeyDown(press('['), mode({ falloffMm: 10 }), path(), s);
    expect(s.setMode).toHaveBeenLastCalledWith(expect.objectContaining({ falloffMm: 8 }));
  });
});

describe('pointKindUpdate', () => {
  it('makes the selected points smooth, and sharp again', () => {
    const smooth = pointKindUpdate(mode({ selectedPointIndex: 1 }), path(), 'smooth');
    expect(smooth?.path?.[1].handleOut).not.toBeNull();
    const curved = path({ path: smooth?.path });
    const sharp = pointKindUpdate(mode({ selectedPointIndex: 1 }), curved, 'corner');
    expect(sharp?.path?.[1].handleOut).toBeNull();
  });

  it('toggles with no kind given', () => {
    const smooth = pointKindUpdate(mode({ selectedPointIndex: 1 }), path());
    expect(smooth?.path?.[1].handleIn).not.toBeNull();
  });

  it('is null with nothing selected', () => {
    expect(pointKindUpdate(mode(), path(), 'smooth')).toBeNull();
  });
});
