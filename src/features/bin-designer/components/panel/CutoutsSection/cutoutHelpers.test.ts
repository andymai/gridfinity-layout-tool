import { describe, it, expect } from 'vitest';
import {
  createDefaultCutout,
  defaultPlaceSize,
  resizeKeepingCenter,
  resizeAroundCenter,
  flattenCutoutArray,
  applyFlattenArray,
  flattenCutoutGroupArray,
  translateCutoutPreview,
} from './cutoutHelpers';
import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';

describe('createDefaultCutout', () => {
  it('seeds a default hexagon side count for polygons', () => {
    const c = createDefaultCutout('id', 'polygon', 0, 0, 16, 14);
    expect(c.sides).toBe(6);
  });

  it('seeds insertion clearance for insert shapes only', () => {
    expect(createDefaultCutout('id', 'polygon', 0, 0, 16, 14).clearance).toBeGreaterThan(0);
    expect(createDefaultCutout('id', 'circle', 0, 0, 15, 15).clearance).toBeGreaterThan(0);
    expect(createDefaultCutout('id', 'slot', 0, 0, 30, 12).clearance).toBeGreaterThan(0);
    expect(createDefaultCutout('id', 'rectangle', 0, 0, 20, 20).clearance).toBeUndefined();
    expect(createDefaultCutout('id', 'rectangle', 0, 0, 20, 20).sides).toBeUndefined();
  });

  it('seeds a tasteful entry chamfer for insert shapes, scaled and clamped', () => {
    // ~10% of the tightest dimension, clamped to 0.4–0.8mm.
    expect(createDefaultCutout('id', 'circle', 0, 0, 6, 6).chamferWidth).toBe(0.6);
    expect(createDefaultCutout('id', 'circle', 0, 0, 3, 3).chamferWidth).toBe(0.4); // min clamp
    expect(createDefaultCutout('id', 'circle', 0, 0, 25, 25).chamferWidth).toBe(0.8); // max clamp
    // Rectangles are pockets/windows, not insert holes — left sharp.
    expect(createDefaultCutout('id', 'rectangle', 0, 0, 20, 20).chamferWidth).toBeUndefined();
  });
});

describe('defaultPlaceSize', () => {
  it('gives a slot an oblong (non-square) footprint so it does not render round', () => {
    const slot = defaultPlaceSize('slot');
    expect(slot.width).toBeGreaterThan(slot.depth);
  });

  it('gives a regular polygon its natural aspect (width != depth for a hexagon)', () => {
    const poly = defaultPlaceSize('polygon');
    expect(poly.width).toBeGreaterThan(poly.depth);
  });

  it('keeps circle and rectangle square', () => {
    expect(defaultPlaceSize('circle').width).toBe(defaultPlaceSize('circle').depth);
    expect(defaultPlaceSize('rectangle').width).toBe(defaultPlaceSize('rectangle').depth);
  });
});

describe('resizeKeepingCenter', () => {
  it('keeps the cutout center fixed when resizing', () => {
    const r = resizeKeepingCenter({ x: 10, y: 10, width: 20, depth: 20 }, 10, 10, 100, 100);
    // Original center (20,20); new 10×10 box centered there → origin (15,15).
    expect(r.x).toBe(15);
    expect(r.y).toBe(15);
    expect(r.width).toBe(10);
    expect(r.depth).toBe(10);
  });

  it('clamps the origin so the box stays inside the bin', () => {
    const r = resizeKeepingCenter({ x: 0, y: 0, width: 10, depth: 10 }, 40, 40, 30, 30);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.width).toBe(30);
    expect(r.depth).toBe(30);
  });
});

describe('resizeAroundCenter', () => {
  // The router-bit case: a 1/4" shank becomes a 1/2" shank and the hole must
  // stay where it was drilled.
  it('grows equally in every direction from the same center', () => {
    const r = resizeAroundCenter(
      { x: 20, y: 20, width: 6.35, depth: 6.35 },
      {
        width: 12.7,
        depth: 12.7,
      }
    );
    const centerOf = (o: number, size: number) => o + size / 2;
    expect(centerOf(r.x, r.width)).toBeCloseTo(centerOf(20, 6.35), 10);
    expect(centerOf(r.y, r.depth)).toBeCloseTo(centerOf(20, 6.35), 10);
  });

  it('moves only the axis being resized', () => {
    const r = resizeAroundCenter({ x: 10, y: 10, width: 20, depth: 20 }, { width: 30 });
    expect(r.x).toBe(5);
    expect(r.y).toBe(10);
    expect(r.depth).toBe(20);
  });

  it('shrinks toward the center too', () => {
    const r = resizeAroundCenter(
      { x: 10, y: 10, width: 20, depth: 20 },
      {
        width: 10,
        depth: 10,
      }
    );
    expect(r).toEqual({ x: 15, y: 15, width: 10, depth: 10 });
  });

  // The deliberate difference from resizeKeepingCenter: a typed size is a
  // measurement, so it is never truncated and the origin is never pulled back
  // onto the board. The off-board warning is what handles the result.
  it('keeps the typed size and lets the result hang off the board', () => {
    const r = resizeAroundCenter(
      { x: 0, y: 0, width: 10, depth: 10 },
      {
        width: 40,
        depth: 40,
      }
    );
    expect(r).toEqual({ x: -15, y: -15, width: 40, depth: 40 });
  });

  it('is a no-op patch when neither dimension changes', () => {
    const box = { x: 10, y: 10, width: 20, depth: 20 };
    expect(resizeAroundCenter(box, {})).toEqual(box);
  });
});

describe('flattenCutoutArray', () => {
  const master = (over: Partial<Cutout> = {}): Cutout => ({
    id: 'm',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 8,
    depth: 8,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...over,
  });

  it('is a no-op when there is no array', () => {
    expect(flattenCutoutArray(master())).toEqual({ masterPatch: {}, added: [] });
  });

  it('strips the array from the master and adds the other instances with fresh ids', () => {
    const c = master({
      array: {
        mode: 'grid',
        cols: 3,
        rows: 1,
        pitchX: 10,
        pitchY: 10,
        count: 3,
        radius: 20,
        startAngle: 0,
        rotateToCenter: true,
      },
    });
    const { masterPatch, added } = flattenCutoutArray(c);
    expect(masterPatch).toEqual({ array: undefined, label: '' });
    expect(added).toHaveLength(2); // 3 instances − the master
    expect(added.every((a) => a.array === undefined)).toBe(true);
    expect(new Set(added.map((a) => a.id)).size).toBe(2); // unique ids
    expect(added.every((a) => a.id !== 'm')).toBe(true);
  });
});

describe('flattenCutoutGroupArray', () => {
  const row: CutoutArrayConfig = {
    mode: 'grid',
    cols: 3,
    rows: 1,
    pitchX: 30,
    pitchY: 30,
    count: 3,
    radius: 20,
    startAngle: 0,
    rotateToCenter: false,
  };

  const pair = (array?: CutoutArrayConfig): Cutout[] => [
    {
      id: 'outer',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 20,
      depth: 20,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: 'g1',
      groupOp: 'exclude',
      ...(array ? { array } : {}),
    },
    {
      id: 'inner',
      shape: 'rectangle',
      x: 5,
      y: 5,
      width: 10,
      depth: 10,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: 'g1',
      groupOp: 'exclude',
      ...(array ? { array } : {}),
    },
  ];

  it('strips the repeat from the original members', () => {
    const { memberPatches } = flattenCutoutGroupArray(pair(row));
    expect(memberPatches.get('outer')).toEqual({ array: undefined });
    expect(memberPatches.get('inner')).toEqual({ array: undefined });
  });

  it('gives every copy its OWN group, so the boolean survives the flatten', () => {
    const { added } = flattenCutoutGroupArray(pair(row));
    // Two copies beyond the original, two members each.
    expect(added).toHaveLength(4);
    const groups = new Set(added.map((c) => c.groupId));
    expect(groups.size).toBe(2);
    expect(groups.has('g1')).toBe(false);
    // Each new group holds a whole copy, not a stray member.
    for (const gid of groups) {
      expect(added.filter((c) => c.groupId === gid)).toHaveLength(2);
    }
  });

  it("keeps the op and the members' relative spacing in every copy", () => {
    const { added } = flattenCutoutGroupArray(pair(row));
    expect(added.every((c) => c.groupOp === 'exclude')).toBe(true);
    for (const gid of new Set(added.map((c) => c.groupId))) {
      const [a, b] = added.filter((c) => c.groupId === gid);
      // The inner rectangle sits 5mm in from the outer one, as it did at copy 0.
      expect(Math.abs(b.x - a.x)).toBe(5);
      expect(Math.abs(b.y - a.y)).toBe(5);
    }
  });

  it('carries no repeat into the copies, so flattening is not undone by a redraw', () => {
    const { added } = flattenCutoutGroupArray(pair(row));
    expect(added.every((c) => c.array === undefined)).toBe(true);
  });

  it('adds nothing for a group with no repeat', () => {
    expect(flattenCutoutGroupArray(pair()).added).toHaveLength(0);
  });
});

describe('applyFlattenArray', () => {
  const gridMaster = (cols: number): Cutout => ({
    id: 'm',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 8,
    depth: 8,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    array: {
      mode: 'grid',
      cols,
      rows: 1,
      pitchX: 10,
      pitchY: 10,
      count: cols,
      radius: 20,
      startAngle: 0,
      rotateToCenter: true,
    },
  });

  /** Records what the flatten did, so a half-application is visible. */
  function spy(capacity: number) {
    const patched: Array<Partial<Cutout>> = [];
    const added: Cutout[] = [];
    return {
      patched,
      added,
      updateCutout: (_id: string, patch: Partial<Cutout>) => void patched.push(patch),
      addCutout: (c: Cutout) => {
        if (added.length >= capacity) return false;
        added.push(c);
        return true;
      },
    };
  }

  const inertTransaction = { start: () => {}, commit: () => {} };

  it('bakes every instance when there is room', () => {
    const s = spy(Infinity);
    const master = gridMaster(3);

    expect(
      applyFlattenArray('m', [master], s.updateCutout, s.addCutout, Infinity, inertTransaction)
    ).toBe('flattened');
    expect(s.patched).toEqual([{ array: undefined, label: '' }]);
    expect(s.added).toHaveLength(2);
  });

  it('wraps the whole flatten in one undo step, even when an add throws', () => {
    const s = spy(Infinity);
    const master = gridMaster(3);
    const calls: string[] = [];
    const transaction = {
      start: () => calls.push('start'),
      commit: () => calls.push('commit'),
    };
    applyFlattenArray('m', [master], s.updateCutout, s.addCutout, Infinity, transaction);
    expect(calls).toEqual(['start', 'commit']);

    const throwing = () => {
      throw new Error('boom');
    };
    expect(() =>
      applyFlattenArray('m', [gridMaster(3)], s.updateCutout, throwing, Infinity, transaction)
    ).toThrow('boom');
    expect(calls).toEqual(['start', 'commit', 'start', 'commit']);
  });

  it('declines whole rather than stripping the repeat it cannot replace', () => {
    // The master patch is destructive: run it with room for one of the two
    // instances and the design keeps neither the array nor what it stood for.
    const s = spy(1);
    const master = gridMaster(3);

    expect(applyFlattenArray('m', [master], s.updateCutout, s.addCutout, 1, inertTransaction)).toBe(
      'no-room'
    );
    expect(s.patched).toEqual([]);
    expect(s.added).toEqual([]);
  });

  it('declines at the cap instead of losing the repeat for nothing', () => {
    const s = spy(0);
    const master = gridMaster(3);

    expect(applyFlattenArray('m', [master], s.updateCutout, s.addCutout, 0, inertTransaction)).toBe(
      'no-room'
    );
    expect(s.patched).toEqual([]);
  });

  it('reports a shape that has no repeat', () => {
    const s = spy(Infinity);
    const plain = { ...gridMaster(3), array: undefined };

    expect(
      applyFlattenArray('m', [plain], s.updateCutout, s.addCutout, Infinity, inertTransaction)
    ).toBe('not-an-array');
    expect(s.patched).toEqual([]);
  });
});

describe('translateCutoutPreview', () => {
  const pathCutout: Cutout = {
    id: 'p',
    shape: 'path',
    x: 10,
    y: 10,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: [
      { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
      { x: 30, y: 10, handleIn: null, handleOut: null, symmetric: false },
      { x: 30, y: 30, handleIn: null, handleOut: null, symmetric: false },
    ],
  };

  it('carries absolute path vertices along with an x/y patch', () => {
    const moved = translateCutoutPreview(pathCutout, { x: 15, y: 40 });
    expect(moved.path?.map((pt) => [pt.x, pt.y])).toEqual([
      [15, 40],
      [35, 40],
      [35, 60],
    ]);
  });

  it('leaves the path alone when the patch does not move the cutout', () => {
    const moved = translateCutoutPreview(pathCutout, { rotation: 45 });
    expect(moved.path).toBe(pathCutout.path);
    expect(moved.rotation).toBe(45);
  });

  it('passes non-path shapes straight through', () => {
    const rect = { ...pathCutout, shape: 'rectangle' as const, path: undefined };
    expect(translateCutoutPreview(rect, { x: 99 })).toEqual({ ...rect, x: 99 });
  });
});

describe('createDefaultCutout — text element', () => {
  it('seeds a caption engraved at an explicit size, centered on itself', () => {
    const c = createDefaultCutout('id', 'text', 0, 0, 20, 10);
    expect(c.label).toBe('Text');
    expect(c.engraveLabel).toBe(true);
    expect(c.textAnchor).toBe('center');
    expect(c.textStyle).toEqual({ sizeMode: 'fixed', fixedSize: 8 });
    // Caption only: no fit fields for a shape that cuts nothing.
    expect(c.clearance).toBeUndefined();
    expect(c.chamferWidth).toBeUndefined();
  });
});
