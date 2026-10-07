// @vitest-environment node
/**
 * A pocket inside a shallower one opens at that pocket's floor, so its entry
 * chamfer belongs there rather than at the fill surface, which is already cut
 * away. Probed on export meshes of a flat, lipless solid host so the fill
 * surface is the bounding box top and every column pairs cleanly.
 *
 * A horizontal line through the opening is measured by swapping the line's
 * axis with Z and reusing the column crossings, which slice triangles exactly
 * where a ruled loft carries no vertices.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import {
  boundingBox,
  columnCrossings,
  meshVolume,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';

let generateBin: (params: BinParams, onProgress?: undefined, forExport?: boolean) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 60000);

const CHAMFER = 0.8;
const WALL = DEFAULT_BIN_PARAMS.wallThickness;
/** How far the freeform tray's curved top edge bows past y = 50. */
const BEZIER_BULGE = 7.5;

function cutout(overrides: Partial<Cutout>): Cutout {
  return {
    id: 'pocket',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 6,
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

/** The tray every case nests into: interior [10, 70] x [10, 50], 6mm deep. */
const TRAY = cutout({ id: 'tray', x: 10, y: 10, width: 60, depth: 40, cutDepth: 6 });

/** The same tray drawn freehand, its top edge bowed outward as a curve. */
const TRAY_PATH = cutout({
  id: 'tray',
  shape: 'path',
  x: 10,
  y: 10,
  width: 60,
  depth: 40 + BEZIER_BULGE,
  cutDepth: 6,
  path: [
    corner(10, 10),
    corner(70, 10),
    { x: 70, y: 50, handleIn: null, handleOut: { dx: -20, dy: 10 }, symmetric: false },
    { x: 10, y: 50, handleIn: { dx: 20, dy: 10 }, handleOut: null, symmetric: false },
  ],
});

const SLOT = cutout({
  id: 'slot',
  shape: 'slot',
  x: 25,
  y: 25,
  width: 30,
  depth: 10,
  cutDepth: 16,
  chamferWidth: CHAMFER,
});

const PATH_POCKET = cutout({
  id: 'path',
  shape: 'path',
  x: 25,
  y: 25,
  width: 25,
  depth: 15,
  cutDepth: 16,
  clearance: 0.2,
  chamferWidth: CHAMFER,
  path: [corner(25, 25), corner(50, 27), corner(48, 40), corner(27, 38)],
});

const SHARP_RECTANGLE = cutout({
  id: 'rectangle',
  x: 25,
  y: 25,
  width: 30,
  depth: 12,
  cutDepth: 16,
  chamferWidth: CHAMFER,
});

function host(cutouts: Cutout[]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'solid',
    height: 6,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', solid: true, stackingLip: false },
    cutouts,
  };
}

interface Frame {
  readonly originX: number;
  readonly originY: number;
  readonly topZ: number;
}

function frameOf(mesh: MeshData): Frame {
  const bb = boundingBox(mesh.vertices);
  return {
    originX: -(bb.maxX - bb.minX - 2 * WALL) / 2,
    originY: -(bb.maxY - bb.minY - 2 * WALL) / 2,
    topZ: bb.maxZ,
  };
}

/** Where a line along `axis` at (`at`, `z`) crosses the surface, as `axis` values. */
function lineCrossings(mesh: MeshData, axis: 'x' | 'y', at: number, z: number): number[] {
  const v = mesh.vertices;
  const swapped = new Float32Array(v.length);
  const along = axis === 'x' ? 0 : 1;
  for (let i = 0; i < v.length; i += 3) {
    swapped[i] = v[i];
    swapped[i + 1] = v[i + 1];
    swapped[i + 2] = v[i + along];
    swapped[i + along] = v[i + 2];
  }
  const swappedMesh = { ...mesh, vertices: swapped };
  return axis === 'x' ? columnCrossings(swappedMesh, z, at) : columnCrossings(swappedMesh, at, z);
}

/** The void around `center` on that line, as [low edge, high edge]. */
function openingAround(
  mesh: MeshData,
  axis: 'x' | 'y',
  at: number,
  z: number,
  center: number
): readonly [number, number] {
  const hits = lineCrossings(mesh, axis, at, z);
  return [Math.max(...hits.filter((h) => h < center)), Math.min(...hits.filter((h) => h > center))];
}

function exportMesh(cutouts: Cutout[]): MeshData {
  return generateBin(host(cutouts), undefined, true);
}

/**
 * A chamfered circle is cut as a 64-gon loft and a plain one as a true
 * cylinder, which preview tessellates coarser, so the baseline keeps a chamfer
 * too small to measure and both sides cut the same faceted outline.
 */
const BASELINE_CHAMFER = 0.06;

function volumeRemovedByChamfer(cutouts: Cutout[], id: string, forExport: boolean): number {
  const plain = cutouts.map((c) => (c.id === id ? { ...c, chamferWidth: BASELINE_CHAMFER } : c));
  const before = meshVolume(generateBin(host(plain), undefined, forExport));
  const after = meshVolume(generateBin(host(cutouts), undefined, forExport));
  return before - after;
}

/** The 45° band an entry chamfer of `chamfer` takes around a rim of `perimeter`. */
function band(perimeter: number, chamfer = CHAMFER): number {
  return (perimeter * chamfer * chamfer) / 2;
}

const SLOT_PERIMETER = 2 * (30 - 10) + Math.PI * 10;

describe('entry chamfer of a pocket nested in a shallower one', () => {
  it('flares a slot wholly inside a freeform pocket at that pocket floor', () => {
    const mesh = exportMesh([TRAY_PATH, SLOT]);
    const { originX, originY, topZ } = frameOf(mesh);
    const floorZ = topZ - TRAY_PATH.cutDepth;
    const x = originX + 40;
    const cy = originY + 30;

    const [lo, hi] = openingAround(mesh, 'y', x, floorZ - 0.2, cy);
    expect(hi - lo).toBeCloseTo(10 + 2 * (CHAMFER - 0.2), 1);

    const [plainLo, plainHi] = openingAround(mesh, 'y', x, floorZ - CHAMFER - 0.3, cy);
    expect(plainHi - plainLo).toBeCloseTo(10, 1);
  }, 120000);

  it('flares the part inside the tray at its floor and the part outside at the surface', () => {
    const circle = cutout({
      id: 'circle',
      shape: 'circle',
      x: 62,
      y: 22,
      width: 16,
      depth: 16,
      cutDepth: 16,
      chamferWidth: CHAMFER,
    });
    const mesh = exportMesh([TRAY, circle]);
    const { originX, originY, topZ } = frameOf(mesh);
    const floorZ = topZ - TRAY.cutDepth;
    const cx = originX + 70;
    const cy = originY + 30;

    const [inside, outside] = openingAround(mesh, 'x', cy, floorZ - 0.2, cx);
    expect(inside).toBeCloseTo(cx - 8 - (CHAMFER - 0.2), 1);
    expect(outside).toBeCloseTo(cx + 8, 1);

    const [, outsideAtTop] = openingAround(mesh, 'x', cy, topZ - 0.2, cx);
    expect(outsideAtTop).toBeCloseTo(cx + 8 + (CHAMFER - 0.2), 1);

    // 0.4mm off the rim, either side of the tray wall: the floor bevel inside,
    // the surface bevel outside, and no floor bevel leaking under the wall.
    const off = Math.sqrt(8.4 ** 2 - 1);
    const insideTop = Math.max(...columnCrossings(mesh, cx - 1, cy + off));
    expect(insideTop).toBeCloseTo(floorZ - (CHAMFER - 0.4), 1);
    const outsideSpans = verticalSolidSpans(mesh, cx + 1, cy + off);
    expect(outsideSpans).toHaveLength(1);
    expect(outsideSpans[0][1]).toBeCloseTo(topZ - (CHAMFER - 0.4), 1);
  }, 120000);

  it('carries the floor bevel up through a scooped tray fillet instead of under it', () => {
    const scooped = { ...TRAY, scoopRadiusW: 3, scoopRadiusD: 3 };
    const circle = cutout({
      id: 'circle',
      shape: 'circle',
      x: 62,
      y: 22,
      width: 16,
      depth: 16,
      cutDepth: 16,
      chamferWidth: CHAMFER,
    });
    const mesh = exportMesh([scooped, circle]);
    const { originX, originY, topZ } = frameOf(mesh);
    const floorZ = topZ - TRAY.cutDepth;
    // 1mm in from the tray wall, where its fillet stands proud of the floor,
    // and 0.4mm off the circle's rim, inside its floor bevel.
    const x = originX + 69;
    const y = originY + 30 + Math.sqrt(8.4 ** 2 - 1);
    const spans = verticalSolidSpans(mesh, x, y);
    expect(spans).toHaveLength(1);
    expect(spans[0][1]).toBeCloseTo(floorZ - (CHAMFER - 0.4), 1);
  }, 120000);

  it('leaves a pocket no deeper than the tray floor alone', () => {
    const tray = meshVolume(exportMesh([TRAY]));
    for (const cutDepth of [4, TRAY.cutDepth]) {
      const nested = meshVolume(exportMesh([TRAY, { ...SLOT, cutDepth }]));
      expect(Math.abs(nested - tray)).toBeLessThan(1);
    }
  }, 120000);

  for (const forExport of [false, true]) {
    const mode = forExport ? 'export' : 'preview';

    it(`flares a rotated slot at the floor (${mode})`, () => {
      const removed = volumeRemovedByChamfer([TRAY, { ...SLOT, rotation: 30 }], 'slot', forExport);
      expect(removed).toBeGreaterThan(0.8 * band(SLOT_PERIMETER));
      expect(removed).toBeLessThan(1.3 * band(SLOT_PERIMETER));
    }, 120000);

    it(`flares every instance of a repeat at the floor (${mode})`, () => {
      const repeated = cutout({
        ...SLOT,
        y: 14,
        depth: 8,
        array: {
          mode: 'grid',
          cols: 1,
          rows: 3,
          pitchX: 1,
          pitchY: 12,
          count: 1,
          radius: 1,
          startAngle: 0,
          rotateToCenter: false,
        },
      });
      const perimeter = 2 * (30 - 8) + Math.PI * 8;
      const removed = volumeRemovedByChamfer([TRAY, repeated], 'slot', forExport);
      expect(removed).toBeGreaterThan(0.8 * 3 * band(perimeter));
      expect(removed).toBeLessThan(1.3 * 3 * band(perimeter));
    }, 120000);

    it(`flares a union member at its sibling's floor (${mode})`, () => {
      const members = [
        { ...TRAY, groupId: 'g', groupOp: 'union' as const },
        { ...SLOT, groupId: 'g', groupOp: 'union' as const },
      ];
      const removed = volumeRemovedByChamfer(members, 'slot', forExport);
      expect(removed).toBeGreaterThan(0.8 * band(SLOT_PERIMETER));
      expect(removed).toBeLessThan(1.3 * band(SLOT_PERIMETER));
    }, 120000);

    it(`flares a circle half inside the tray all the way round (${mode})`, () => {
      const circle = cutout({
        id: 'circle',
        shape: 'circle',
        x: 62,
        y: 22,
        width: 16,
        depth: 16,
        cutDepth: 16,
        chamferWidth: CHAMFER,
      });
      const removed = volumeRemovedByChamfer([TRAY, circle], 'circle', forExport);
      expect(removed).toBeGreaterThan(0.8 * band(Math.PI * 16));
      expect(removed).toBeLessThan(1.3 * band(Math.PI * 16));
    }, 120000);

    for (const pocket of [PATH_POCKET, SHARP_RECTANGLE]) {
      it(`sinks a ${pocket.shape} pocket's chamfer to the floor unchanged (${mode})`, () => {
        const atSurface = volumeRemovedByChamfer([pocket], pocket.id, forExport);
        const atFloor = volumeRemovedByChamfer([TRAY, pocket], pocket.id, forExport);
        expect(atSurface).toBeGreaterThan(0.5 * band(60));
        expect(atFloor / atSurface).toBeCloseTo(1, 1);
      }, 120000);
    }

    // A leaned flare is square to the pocket's axis, so the level it opens at
    // cuts it on a slant; at the floor it must cut the same as at the surface.
    it(`flares a leaned slot at the floor as it does at the surface (${mode})`, () => {
      const leaned = { ...SLOT, leanDeg: 20 };
      const atSurface = volumeRemovedByChamfer([leaned], 'slot', forExport);
      const atFloor = volumeRemovedByChamfer([TRAY, leaned], 'slot', forExport);
      expect(atSurface).toBeGreaterThan(band(SLOT_PERIMETER));
      expect(atFloor / atSurface).toBeGreaterThan(0.95);
      expect(atFloor / atSurface).toBeLessThan(1.05);
    }, 120000);
  }
});
