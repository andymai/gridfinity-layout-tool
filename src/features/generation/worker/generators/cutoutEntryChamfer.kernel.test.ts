// @vitest-environment node
/**
 * An entry chamfer is a 45° band around the pocket's rim, so it removes about
 * `perimeter × chamfer² / 2` of material. Measuring that against the same bin
 * with the chamfer off catches a builder that quietly cuts a straight wall
 * instead, which every structural and triangle-count check accepts.
 *
 * The path cases round their inner corner tighter than the clearance plus the
 * chamfer, as an imported or traced outline does at any tight inside curve.
 * Offsetting that corner outward overshoots its own centre of curvature.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import { flattenPathToPolyline } from '@/shared/utils/pathCutoutOutline';
import { meshVolume } from './__kernel-tests__/meshAssertions';

let generateBin: (params: BinParams, onProgress?: undefined, forExport?: boolean) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 60000);

const CHAMFER = 0.8;
const CUT_DEPTH = 6;
const BEZIER_QUARTER_CIRCLE = 0.5523;

function cutout(overrides: Partial<Cutout>): Cutout {
  return {
    id: 'pocket',
    shape: 'rectangle',
    x: 20,
    y: 20,
    width: 30,
    depth: 12,
    cutDepth: CUT_DEPTH,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    scoopRadiusW: 0,
    scoopRadiusD: 0,
    ...overrides,
  };
}

function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false };
}

/** A 30×25 L whose inner corner is a quarter circle of `radius`. */
function roundedL(radius: number): PathPoint[] {
  const k = BEZIER_QUARTER_CIRCLE * radius;
  return [
    corner(10, 10),
    corner(40, 10),
    corner(40, 18),
    { x: 20 + radius, y: 18, handleIn: null, handleOut: { dx: -k, dy: 0 }, symmetric: false },
    { x: 20, y: 18 + radius, handleIn: { dx: 0, dy: -k }, handleOut: null, symmetric: false },
    corner(20, 35),
    corner(10, 35),
  ];
}

function pathCutout(path: PathPoint[], overrides: Partial<Cutout>): Cutout {
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return cutout({
    shape: 'path',
    x,
    y,
    width: Math.max(...xs) - x,
    depth: Math.max(...ys) - y,
    path,
    ...overrides,
  });
}

function polylinePerimeter(path: readonly PathPoint[]): number {
  const pts = flattenPathToPolyline(path);
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const b = pts[(i + 1) % pts.length];
    total += Math.hypot(b.x - pts[i].x, b.y - pts[i].y);
  }
  return total;
}

function solidBin(pocket: Cutout): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [pocket],
  };
}

function removedBy(change: Partial<Cutout>, pocket: Cutout, forExport: boolean): number {
  const before = meshVolume(generateBin(solidBin(pocket), undefined, forExport));
  const after = meshVolume(generateBin(solidBin({ ...pocket, ...change }), undefined, forExport));
  return before - after;
}

interface ChamferCase {
  readonly name: string;
  readonly pocket: Cutout;
  readonly perimeter: number;
}

const SLOT_W = 30.2;
const SLOT_D = 12.2;
const CIRCLE_D = 16.2;

const CHAMFER_CASES: readonly ChamferCase[] = [
  {
    name: 'path with a 1mm inner corner',
    pocket: pathCutout(roundedL(1), { clearance: 0.7 }),
    perimeter: polylinePerimeter(roundedL(1)),
  },
  {
    name: 'rotated path with a 0.5mm inner corner',
    pocket: pathCutout(roundedL(0.5), { clearance: 0.7, rotation: 22.59 }),
    perimeter: polylinePerimeter(roundedL(0.5)),
  },
  {
    name: 'slot',
    pocket: cutout({ shape: 'slot', width: 30, depth: 12, clearance: 0.2 }),
    perimeter: 2 * (SLOT_W - SLOT_D) + Math.PI * SLOT_D,
  },
  {
    name: 'circle',
    pocket: cutout({ shape: 'circle', width: 16, depth: 16, clearance: 0.2 }),
    perimeter: Math.PI * CIRCLE_D,
  },
  {
    name: 'rectangle',
    pocket: cutout({ shape: 'rectangle', width: 30, depth: 12 }),
    perimeter: 2 * (30 + 12),
  },
];

describe('entry chamfer', () => {
  for (const c of CHAMFER_CASES) {
    for (const forExport of [false, true]) {
      it(`flares the rim of a ${c.name} (${forExport ? 'export' : 'preview'})`, () => {
        const band = (c.perimeter * CHAMFER * CHAMFER) / 2;
        const removed = removedBy({ chamferWidth: CHAMFER }, c.pocket, forExport);
        expect(removed).toBeGreaterThan(0.8 * band);
        expect(removed).toBeLessThan(1.3 * band);
      }, 120000);
    }
  }
});

describe('path insertion clearance', () => {
  it('widens a path whose inner corner is tighter than the clearance', () => {
    const path = roundedL(0.5);
    const clearance = 0.7;
    const removed = removedBy({ clearance }, pathCutout(path, {}), false);
    const band = polylinePerimeter(path) * clearance * CUT_DEPTH;
    expect(removed).toBeGreaterThan(0.8 * band);
    expect(removed).toBeLessThan(1.3 * band);
  }, 120000);
});
