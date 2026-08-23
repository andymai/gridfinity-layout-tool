import { describe, expect, it } from 'vitest';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import {
  alignSnap,
  rotationRingRadiusMm,
  snapAngleDeg,
  resolvePlacedParts,
  snapCoord,
  worldToParentLocal,
  sceneToStore,
  storeToScene,
} from './workshopPlacement';

function part(
  type: 'post' | 'block',
  id: string,
  transform: Partial<AssemblyPartNode['transform']>,
  extra: Partial<AssemblyPartNode> = {}
): AssemblyPartNode {
  return {
    ...createAssemblyPartNode(type, id, { ...DEFAULT_PART_TRANSFORM, ...transform }),
    ...extra,
  } as AssemblyPartNode;
}

function structureWith(parts: AssemblyPartNode[]): AssemblyStructure {
  return { ...DEFAULT_ASSEMBLY_STRUCTURE, parts };
}

describe('resolvePlacedParts', () => {
  it('seats a child on its parent top face, in the parent frame', () => {
    const block = part('block', 'b', { x: 60, y: 30, rotZDeg: 90 });
    const post = part('post', 'p', { x: 10, y: 0 });
    const placed = resolvePlacedParts(structureWith([{ ...block, children: [post] }]));
    const child = placed.find((p) => p.selectId === 'p');
    expect(child?.z).toBe(20);
    expect(child?.rotZDeg).toBe(90);
    expect(child?.x).toBeCloseTo(60);
    expect(child?.y).toBeCloseTo(40);
    expect(child?.parentId).toBe('b');
  });

  it('applies seatZ relative to the parent top, not the floor', () => {
    const block = part('block', 'b', {});
    const sunk = part('post', 'p', { seatZ: -5 });
    const placed = resolvePlacedParts(structureWith([{ ...block, children: [sunk] }]));
    expect(placed.find((p) => p.selectId === 'p')?.z).toBe(15);
  });

  it('expands a linear array with unique keys and one shared selectId', () => {
    const arrayed = part('post', 'p', { x: 10 }, { array: { count: 3, dx: 20, dy: 0 } });
    const placed = resolvePlacedParts(structureWith([arrayed]));
    expect(placed).toHaveLength(3);
    expect(placed.map((p) => p.x)).toEqual([10, 30, 50]);
    expect(new Set(placed.map((p) => p.key)).size).toBe(3);
    expect(new Set(placed.map((p) => p.selectId))).toEqual(new Set(['p']));
  });
});

describe('mirror expansion', () => {
  const extent = { w: 168, d: 84 };

  it('emits a reflected twin across the left-right plane', () => {
    const fin = part('block', 'b', { x: 40, y: 30, rotZDeg: 30 }, { mirror: true });
    const placed = resolvePlacedParts(structureWith([fin]), extent);
    expect(placed).toHaveLength(2);
    const twin = placed.find((p) => p.mirrored);
    expect(twin?.x).toBeCloseTo(168 - 40);
    expect(twin?.y).toBeCloseTo(30);
    expect(twin?.rotZDeg).toBeCloseTo(-30);
    expect(twin?.selectId).toBe('b');
    expect(new Set(placed.map((p) => p.key)).size).toBe(2);
  });

  it('reflects children inside the mirrored frame', () => {
    const post = part('post', 'p', { x: 10, y: 5 });
    const block = part('block', 'b', { x: 40, y: 30 }, { mirror: true, children: [post] });
    const placed = resolvePlacedParts(structureWith([block]), extent);
    const twinChild = placed.find((p) => p.selectId === 'p' && p.mirrored);
    expect(twinChild?.x).toBeCloseTo(168 - 40 - 10);
    expect(twinChild?.y).toBeCloseTo(30 + 5);
  });

  it('ignores mirror without a base extent and off the root level', () => {
    const fin = part('block', 'b', { x: 40, y: 30 }, { mirror: true });
    expect(resolvePlacedParts(structureWith([fin]))).toHaveLength(1);
    const child = part('post', 'p', { x: 5, y: 5 }, { mirror: true });
    const parent = part('block', 'root', { x: 40, y: 30 }, { children: [child] });
    const placed = resolvePlacedParts(structureWith([parent]), extent);
    expect(placed.filter((p) => p.selectId === 'p')).toHaveLength(1);
  });

  it('mirrors across the front-back plane when the axis is y', () => {
    const fin = part('block', 'b', { x: 40, y: 30 }, { mirror: true });
    const structure = { ...structureWith([fin]), mirrorAxis: 'y' as const };
    const twin = resolvePlacedParts(structure, extent).find((p) => p.mirrored);
    expect(twin?.x).toBeCloseTo(40);
    expect(twin?.y).toBeCloseTo(84 - 30);
  });
});

describe('coordinate helpers', () => {
  it('snaps to the 3.5mm sub-grid and to fine steps', () => {
    expect(snapCoord(5.1, false)).toBeCloseTo(3.5);
    expect(snapCoord(5.3, false)).toBeCloseTo(7);
    expect(snapCoord(5.13, true)).toBeCloseTo(5.1);
  });

  it('round-trips scene and store frames', () => {
    expect(sceneToStore(storeToScene(30, 168), 168)).toBeCloseTo(30);
  });

  it('inverts a rotated parent frame', () => {
    const placed = resolvePlacedParts(
      structureWith([part('block', 'b', { x: 50, y: 50, rotZDeg: 90 })])
    );
    const parent = placed[0];
    if (!parent) throw new Error('unreachable');
    const local = worldToParentLocal({ x: 50, y: 60 }, parent);
    expect(local.x).toBeCloseTo(10);
    expect(local.y).toBeCloseTo(0);
  });
});

describe('snapAngleDeg', () => {
  it('snaps to 15-degree detents by default', () => {
    expect(snapAngleDeg(22, false)).toBe(15);
    expect(snapAngleDeg(23, false)).toBe(30);
    expect(snapAngleDeg(-52, false)).toBe(-45);
  });

  it('snaps to 1 degree in fine mode', () => {
    expect(snapAngleDeg(22.4, true)).toBe(22);
  });

  it('normalizes to (-180, 180] so the readout stays friendly', () => {
    expect(snapAngleDeg(270, false)).toBe(-90);
    expect(snapAngleDeg(-270, false)).toBe(90);
    expect(snapAngleDeg(180, false)).toBe(180);
    expect(snapAngleDeg(-180, false)).toBe(180);
  });
});

describe('alignSnap', () => {
  const candidates = { xs: [40, 80], ys: [21] };

  it('snaps an axis to a nearby candidate and reports the guide', () => {
    const result = alignSnap({ x: 41.2, y: 10 }, candidates, false);
    expect(result.x).toBe(40);
    expect(result.guideX).toBe(40);
    expect(result.guideY).toBeNull();
    // The unaligned axis still takes the magnetic grid.
    expect(result.y).toBe(10.5);
  });

  it('prefers the closest candidate when two are in range', () => {
    const result = alignSnap({ x: 41.6, y: 0 }, { xs: [40, 42.5], ys: [] }, false);
    expect(result.x).toBe(42.5);
  });

  it('falls back to the grid outside the alignment radius', () => {
    const result = alignSnap({ x: 45, y: 0 }, candidates, false);
    expect(result.guideX).toBeNull();
    expect(result.x).toBe(45.5);
  });

  it('fine mode disables both magnetic pulls, keeping the 0.1mm grid', () => {
    const result = alignSnap({ x: 40.4, y: 21.3 }, candidates, true);
    expect(result.guideX).toBeNull();
    expect(result.guideY).toBeNull();
    expect(result.x).toBeCloseTo(40.4, 6);
    expect(result.y).toBeCloseTo(21.3, 6);
  });
});

describe('rotationRingRadiusMm', () => {
  it('clears the part footprint with a margin, never cramped', () => {
    const wide = { node: { type: 'block', params: { width: 60, depth: 20, height: 20 } } };
    expect(rotationRingRadiusMm(wide as never)).toBe(38);
    const tiny = { node: { type: 'post', params: { diameter: 8, height: 40 } } };
    expect(rotationRingRadiusMm(tiny as never)).toBe(14);
  });
});
