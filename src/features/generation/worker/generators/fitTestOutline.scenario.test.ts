// @vitest-environment node
/**
 * Outline fit test.
 *
 * The outline's one claim is that each ring's inner edge is the pocket wall the
 * bin cuts, so every size is checked twice: against the hole the generated BIN
 * has under its fill surface, and against the opening the cutout's own numbers
 * describe. Measured on a plane slice of the exported mesh, not on its bounding
 * box: a set of rings with the wrong holes has the right box.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadFont, isErr } from 'brepjs';
import type { CrossSection, ManifoldToplevel, SimplePolygon } from 'manifold-3d';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import { buildSTLBuffer } from '@/shared/generation/export';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { isOk } from '@/core/result';
import {
  estimateFitTestOutlineVolumeMm3,
  planFitTestOutlineSplit,
} from '@/shared/utils/fitTestOutlinePlan';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity, meshVolume } from './__kernel-tests__/meshAssertions';
import { setManifoldModuleForTests } from '../manifoldRuntime';
import { prepareMeshImprints } from './meshImprint';
import { importMeshFromStl } from './meshImport';
import type { MeshData } from '../../bridge/types';
// Type-only, so the generator modules still load after the kernel is registered.
import type * as FitTestOutline from './fitTestOutline';
import type * as FitTestSlice from './fitTestSlice';

let module: ManifoldToplevel;
let toolAsset: MeshAsset;
let buildFitTestOutlineMeshes: typeof FitTestOutline.buildFitTestOutlineMeshes;
let fitTestBandTopZ: typeof FitTestSlice.fitTestBandTopZ;

/** Triangle soup for an axis-aligned box with outward winding. */
function boxSoup(w: number, d: number, h: number): Float32Array {
  const c = [
    [0, 0, 0],
    [w, 0, 0],
    [w, d, 0],
    [0, d, 0],
    [0, 0, h],
    [w, 0, h],
    [w, d, h],
    [0, d, h],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [2, 3, 7],
    [2, 7, 6],
    [0, 4, 7],
    [0, 7, 3],
    [1, 2, 6],
    [1, 6, 5],
  ];
  const soup = new Float32Array(faces.length * 9);
  faces.forEach((face, f) => face.forEach((vi, v) => soup.set(c[vi], f * 9 + v * 3)));
  return soup;
}

beforeAll(async () => {
  await initBrepjs();
  // Without a loaded font the engraved label below never cuts, and the test
  // that it is left out of the outline would pass on nothing.
  const font = readFileSync(
    resolve(__dirname, '../../../../shared/fonts/assets/JetBrainsMono-Regular.ttf')
  );
  const loaded = await loadFont(
    font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
    'jetbrains-mono'
  );
  if (isErr(loaded)) throw new Error(`Font load failed: ${loaded.error.message}`);

  const ManifoldModule = (await import('manifold-3d')).default;
  const wasmBinary = readFileSync(join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
  module = await ManifoldModule({ wasmBinary } as unknown as { locateFile: () => string });
  module.setup();
  setManifoldModuleForTests(module);

  const soup = boxSoup(20, 10, 5);
  const imported = await importMeshFromStl(
    buildSTLBuffer(soup, new Float32Array(soup.length), 'tool'),
    'tool.stl',
    undefined,
    module
  );
  if (!isOk(imported)) throw new Error(`fixture import failed: ${imported.error.message}`);
  toolAsset = imported.value.asset;

  ({ buildFitTestOutlineMeshes } = await import('./fitTestOutline'));
  ({ fitTestBandTopZ } = await import('./fitTestSlice'));
}, 120_000);

const cutout = (over: Partial<Cutout>): Cutout => ({
  id: 'c',
  shape: 'circle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 6,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...over,
});

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

const WALL = 1.2;
const HEIGHT = 0.6;

/**
 * A 3x2 shadow board carrying every cutout kind the card carries. The
 * rectangle and hexagon have entry chamfers and the rectangle an engraved
 * label, none of which belong in the outline.
 */
function board(): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 4,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutoutConfig: { topOffset: 0 },
    // The one font the suite loads; the default face would skip the engraving.
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, font: 'jetbrains-mono' },
    meshAssets: { 'asset-1': toolAsset },
    cutouts: [
      cutout({
        id: 'rect',
        shape: 'rectangle',
        x: 6,
        y: 8,
        width: 24,
        depth: 14,
        chamferWidth: 0.6,
        label: 'Rect',
        engraveLabel: true,
        textAnchor: 'bottom',
      }),
      cutout({ id: 'circ', x: 40, y: 8, width: 16, depth: 16, clearance: 0.4 }),
      cutout({
        id: 'path',
        shape: 'path',
        x: 70,
        y: 6,
        width: 20,
        depth: 20,
        rotation: 30,
        clearance: 0.3,
        path: [
          corner(70, 6),
          corner(90, 6),
          corner(90, 16),
          corner(80, 16),
          corner(80, 26),
          corner(70, 26),
        ],
      }),
      cutout({
        id: 'mesh',
        shape: 'mesh',
        meshId: 'asset-1',
        x: 8,
        y: 45,
        width: toolAsset.sizeMm.x,
        depth: toolAsset.sizeMm.y,
        cutDepth: toolAsset.sizeMm.z,
        clearance: 0.5,
      }),
      cutout({ id: 'u1', x: 45, y: 45, width: 18, depth: 18 }),
      cutout({ id: 'u2', x: 57, y: 50, width: 18, depth: 18 }),
      cutout({
        id: 'hex',
        shape: 'polygon',
        sides: 6,
        x: 92,
        y: 45,
        width: 18,
        depth: 15.6,
        clearance: 0.2,
        chamferWidth: 0.8,
      }),
    ],
  };
}

/**
 * Model-frame point inside a cutout: its centre, or a local offset from it
 * turned the way the builder turns the tool (clockwise by `rotation`).
 */
function probe(params: BinParams, id: string, local = { x: 0, y: 0 }): [number, number] {
  const c = params.cutouts.find((k) => k.id === id);
  if (!c) throw new Error(`no cutout ${id}`);
  const innerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
  const innerD = params.depth * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
  const rad = (-c.rotation * Math.PI) / 180;
  return [
    c.x + c.width / 2 - innerW / 2 + local.x * Math.cos(rad) - local.y * Math.sin(rad),
    c.y + c.depth / 2 - innerD / 2 + local.x * Math.sin(rad) + local.y * Math.cos(rad),
  ];
}

/** The L's centre is its inner corner, so its probe sits in the long leg. */
const PATH_PROBE = { x: -5, y: -5 };

function signedArea(poly: SimplePolygon): number {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    twice += ax * by - bx * ay;
  }
  return twice / 2;
}

function contains(poly: SimplePolygon, [x, y]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bbox(poly: SimplePolygon): { w: number; d: number } {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
}

interface Section {
  readonly outers: SimplePolygon[];
  readonly holes: SimplePolygon[];
}

/** Contours of a mesh cut by the plane Z=`z`, split into outlines and holes. */
function section(mesh: { vertices: Float32Array; indices: Uint32Array }, z: number): Section {
  const input = new module.Mesh({
    numProp: 3,
    vertProperties: mesh.vertices,
    triVerts: mesh.indices,
  });
  input.merge();
  const solid = new module.Manifold(input);
  const cut = solid.slice(z);
  try {
    const contours = cut.toPolygons();
    return {
      outers: contours.filter((p) => signedArea(p) > 0),
      holes: contours.filter((p) => signedArea(p) < 0),
    };
  } finally {
    cut.delete();
    solid.delete();
  }
}

/** The smallest contour enclosing the point, which for a hole is the pocket. */
function enclosing(contours: SimplePolygon[], point: [number, number]): SimplePolygon {
  const hits = contours.filter((p) => contains(p, point));
  if (hits.length === 0) throw new Error(`no contour around (${point.join(', ')})`);
  return hits.reduce((a, b) => (Math.abs(signedArea(a)) < Math.abs(signedArea(b)) ? a : b));
}

const asMeshData = (p: { vertices: Float32Array; indices: Uint32Array }): MeshData =>
  p as unknown as MeshData;

const outlineCache = new Map<string, ReturnType<typeof buildFitTestOutlineMeshes>>();
async function outline(
  params: BinParams,
  options: Parameters<typeof buildFitTestOutlineMeshes>[1] = {}
): Promise<ReturnType<typeof buildFitTestOutlineMeshes>> {
  const key = JSON.stringify([params, options]);
  const hit = outlineCache.get(key);
  if (hit) return hit;
  await prepareMeshImprints(params, module);
  const built = buildFitTestOutlineMeshes(params, options);
  outlineCache.set(key, built);
  return built;
}

const defaultSize = { size: { heightMm: HEIGHT, wallMm: WALL } };

describe('outline fit test: the print', () => {
  it('stands on the bed at the chosen height', async () => {
    const piece = (await outline(board(), defaultSize)).pieces[0];
    const box = boundingBox(piece.vertices);
    expect(box.minZ).toBeCloseTo(0, 4);
    expect(box.maxZ).toBeCloseTo(HEIGHT, 4);
  });

  it('prints a single layer when asked for one', async () => {
    const piece = (await outline(board(), { size: { heightMm: 0.2, wallMm: WALL } })).pieces[0];
    const box = boundingBox(piece.vertices);
    expect(box.maxZ - box.minZ).toBeCloseTo(0.2, 4);
  });

  it('is clean, watertight geometry', async () => {
    const piece = (await outline(board(), defaultSize)).pieces[0];
    expect(piece.indices.length).toBeGreaterThan(0);
    expect(piece.indices.length % 3).toBe(0);
    expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
    expect(hasNoNaNOrInfinity(piece.normals)).toBe(true);

    const input = new module.Mesh({
      numProp: 3,
      vertProperties: piece.vertices,
      triVerts: piece.indices,
    });
    input.merge();
    // The constructor throws on anything that is not a closed 2-manifold.
    const solid = new module.Manifold(input);
    expect(solid.volume()).toBeGreaterThan(0);
    solid.delete();
  });
});

describe('outline fit test: every ring traces its pocket wall', () => {
  const ids: Array<{ id: string; local?: { x: number; y: number } }> = [
    { id: 'rect' },
    { id: 'circ' },
    { id: 'path', local: PATH_PROBE },
    { id: 'mesh' },
    { id: 'u1' },
    { id: 'hex' },
  ];

  it.each(ids)('matches the hole the bin cuts for $id', async ({ id, local }) => {
    const params = board();
    const piece = (await outline(params, defaultSize)).pieces[0];
    const binMesh = getGenerateBin()(params, undefined, true);
    // A millimetre down, under both entry chamfers, where the bin's wall is
    // the straight wall a part has to clear.
    const binHoles = section(binMesh, fitTestBandTopZ(params) - 1).holes;
    const ringHoles = section(piece, HEIGHT / 2).holes;

    const point = probe(params, id, local);
    const ring = enclosing(ringHoles, point);
    const pocket = enclosing(binHoles, point);
    expect(bbox(ring).w).toBeCloseTo(bbox(pocket).w, 1);
    expect(bbox(ring).d).toBeCloseTo(bbox(pocket).d, 1);
    expect(Math.abs(signedArea(ring))).toBeCloseTo(Math.abs(signedArea(pocket)), -1);
  });

  it('sizes a plain opening by its own numbers, not by its chamfered rim', async () => {
    const params = board();
    const holes = section((await outline(params, defaultSize)).pieces[0], HEIGHT / 2).holes;

    // A rectangle cuts to exact size; its 0.6mm chamfer would read 25.2 x 15.2.
    const rect = bbox(enclosing(holes, probe(params, 'rect')));
    expect(rect.w).toBeCloseTo(24, 1);
    expect(rect.d).toBeCloseTo(14, 1);

    // A circle grows by its whole clearance across the diameter.
    const circ = bbox(enclosing(holes, probe(params, 'circ')));
    expect(circ.w).toBeCloseTo(16.4, 1);
    expect(circ.d).toBeCloseTo(16.4, 1);

    // A hexagon scales so its across-flats grows by the clearance; its 0.8mm
    // chamfer would add 1.6 on top.
    expect(bbox(enclosing(holes, probe(params, 'hex'))).d).toBeCloseTo(15.8, 1);
  });

  it('grows each ring outward by the chosen width', async () => {
    const params = board();
    const outers = section((await outline(params, defaultSize)).pieces[0], HEIGHT / 2).outers;
    const rect = bbox(enclosing(outers, probe(params, 'rect')));
    expect(rect.w).toBeCloseTo(24 + 2 * WALL, 1);
    expect(rect.d).toBeCloseTo(14 + 2 * WALL, 1);
  });

  it('draws one outline around overlapping cutouts, not two crossing rings', async () => {
    const params = board();
    const holes = section((await outline(params, defaultSize)).pieces[0], HEIGHT / 2).holes;
    const union = enclosing(holes, probe(params, 'u1'));
    expect(contains(union, probe(params, 'u2'))).toBe(true);
  });

  it('carries one ring per pocket and nothing for the engraved label', async () => {
    // rect, circ, path, mesh, the overlapping pair, hex.
    const cut = section((await outline(board(), defaultSize)).pieces[0], HEIGHT / 2);
    expect(cut.holes).toHaveLength(6);
    expect(cut.outers).toHaveLength(6);
  });
});

describe('outline fit test: cost', () => {
  it('is priced within reach of what it prints', async () => {
    const params = board();
    const piece = (await outline(params, defaultSize)).pieces[0];
    const actual = meshVolume(asMeshData(piece));
    const predicted = estimateFitTestOutlineVolumeMm3(params, { heightMm: HEIGHT, wallMm: WALL });
    // Overlapping rings are priced whole, so the estimate may only read high.
    expect(predicted).toBeGreaterThanOrEqual(actual * 0.97);
    expect(predicted).toBeLessThan(actual * 1.2);
  });
});

describe('outline fit test: a bed smaller than the outline', () => {
  const bed = { width: 80, depth: 200 };

  it('splits into pieces that each fit, and loses nothing', async () => {
    const params = board();
    const whole = (await outline(params, defaultSize)).pieces[0];
    const split = await outline(params, { ...defaultSize, bed });

    expect(split.pieces.length).toBeGreaterThan(1);
    expect(split.pieces).toHaveLength(
      planFitTestOutlineSplit(params, bed, getSplitPlanePositionsMm, WALL).pieceCount
    );
    for (const piece of split.pieces) {
      const box = boundingBox(piece.vertices);
      expect(box.maxX - box.minX).toBeLessThanOrEqual(bed.width);
      expect(piece.label).toMatch(/^[A-Z]\d$/);
    }
    const summed = split.pieces.reduce((sum, p) => sum + meshVolume(asMeshData(p)), 0);
    expect(summed).toBeCloseTo(meshVolume(asMeshData(whole)), 0);
  });
});

/** A plane section of a mesh. The caller deletes it. */
function crossSection(
  mesh: { vertices: Float32Array; indices: Uint32Array },
  z: number
): CrossSection {
  const input = new module.Mesh({
    numProp: 3,
    vertProperties: mesh.vertices,
    triVerts: mesh.indices,
  });
  input.merge();
  const solid = new module.Manifold(input);
  try {
    return solid.slice(z);
  } finally {
    solid.delete();
  }
}

/**
 * How far a ring's inner edge strays from the bin's own pocket walls, as two
 * areas (mm²): ring lying inside a pocket, and pocket wall left without ring
 * in the 0.3mm just outside it. Both stay near zero only when the inner edge
 * runs along the wall, wherever the pocket is: a hole, a notch out through
 * the board edge, or the island a subtract leaves. The pockets are what the
 * cutouts take out of the plain body a millimetre under the fill surface.
 */
function edgeMismatchMm2(
  params: BinParams,
  piece: { vertices: Float32Array; indices: Uint32Array }
): { intrusion: number; gap: number } {
  const generate = getGenerateBin();
  const z = fitTestBandTopZ(params) - 1;
  const owned: CrossSection[] = [];
  const keep = (c: CrossSection): CrossSection => {
    owned.push(c);
    return c;
  };
  try {
    const material = keep(crossSection(generate(params, undefined, true), z));
    const body = keep(crossSection(generate({ ...params, cutouts: [] }, undefined, true), z));
    const pockets = keep(body.subtract(material));
    const ring = keep(crossSection(piece, HEIGHT / 2));
    const band = keep(
      keep(keep(pockets.offset(0.3, 'Round')).subtract(pockets)).intersect(material)
    );
    return {
      intrusion: keep(ring.intersect(pockets)).area(),
      gap: keep(band.subtract(ring)).area(),
    };
  } finally {
    for (const c of owned) c.delete();
  }
}

/** Measured noise is under 1e-4; an edge 0.1mm off the wall here reads tens of mm². */
const EDGE_TOLERANCE_MM2 = 0.05;

describe('outline fit test: arrays, pathfinder groups and open sides', () => {
  const INNER_W = 3 * 42 - GRIDFINITY.TOLERANCE - 2 * DEFAULT_BIN_PARAMS.wallThickness;

  function features(): BinParams {
    return {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 4,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutoutConfig: { topOffset: 0 },
      cutouts: [
        cutout({
          id: 'row',
          x: 6,
          y: 6,
          width: 10,
          depth: 10,
          clearance: 0.2,
          array: {
            mode: 'grid',
            cols: 3,
            rows: 1,
            pitchX: 15,
            pitchY: 15,
            count: 1,
            radius: 10,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
        cutout({
          id: 'tray',
          shape: 'rectangle',
          x: 60,
          y: 6,
          width: 30,
          depth: 20,
          groupId: 'g',
          groupOp: 'subtract',
        }),
        cutout({
          id: 'post',
          x: 70,
          y: 11,
          width: 10,
          depth: 10,
          groupId: 'g',
          groupOp: 'subtract',
          zIndex: 1,
        }),
        cutout({
          id: 'open',
          shape: 'rectangle',
          x: INNER_W - 25,
          y: 45,
          width: 20,
          depth: 20,
          openSides: [{ side: 'right' }],
        }),
      ],
    };
  }

  it('runs every inner edge along the wall the bin cuts', async () => {
    const params = features();
    const piece = (await outline(params, defaultSize)).pieces[0];
    const { intrusion, gap } = edgeMismatchMm2(params, piece);
    expect(intrusion).toBeLessThan(EDGE_TOLERANCE_MM2);
    expect(gap).toBeLessThan(EDGE_TOLERANCE_MM2);
  });

  it('rings every copy of an array', async () => {
    const params = features();
    const holes = section((await outline(params, defaultSize)).pieces[0], HEIGHT / 2).holes;
    for (const dx of [0, 15, 30]) {
      const hole = bbox(enclosing(holes, probe(params, 'row', { x: dx, y: 0 })));
      expect(hole.w).toBeCloseTo(10.2, 1);
    }
  });

  it('rings the post a subtract leaves standing in its pocket', async () => {
    const params = features();
    const cut = section((await outline(params, defaultSize)).pieces[0], HEIGHT / 2);
    // The tray's ring has a hole (the pocket), and inside that hole the post
    // carries a ring of its own around its edge, which is a second outline.
    const tray = enclosing(cut.holes, probe(params, 'tray', { x: -10, y: 0 }));
    const postRing = cut.outers.filter((o) => contains(tray, o[0]));
    expect(postRing).toHaveLength(1);
    expect(bbox(postRing[0]).w).toBeCloseTo(10, 1);
  });

  it('follows an open side out through the board edge instead of closing it', async () => {
    const params = features();
    const piece = (await outline(params, defaultSize)).pieces[0];
    const cut = section(piece, HEIGHT / 2);
    // No closed hole at the open pocket: its ring is a U that ends at the edge.
    expect(cut.holes.some((h) => contains(h, probe(params, 'open')))).toBe(false);
    const binRight = boundingBox(getGenerateBin()(params, undefined, true).vertices).maxX;
    expect(boundingBox(piece.vertices).maxX).toBeCloseTo(binRight, 1);
  });
});

describe('outline fit test: the dialog plans the pieces the worker cuts', () => {
  // A 4x1 rail whose one pocket sits at the left end. Its box alone fits a
  // 100mm bed; open to the right wall, its ring runs the length of the rail.
  const rail = (open: boolean): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 1,
    height: 4,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutoutConfig: { topOffset: 0 },
    cutouts: [
      cutout({
        id: 'a',
        shape: 'rectangle',
        x: 5,
        y: 10,
        width: 20,
        depth: 15,
        ...(open ? { openSides: [{ side: 'right' as const }] } : {}),
      }),
    ],
  });
  const bed = { width: 100, depth: 200 };

  it.each([false, true])('agrees on the piece count with an open side: %s', async (open) => {
    const params = rail(open);
    const plan = planFitTestOutlineSplit(params, bed, getSplitPlanePositionsMm, WALL);
    const built = await outline(params, { ...defaultSize, bed });

    expect(built.pieces).toHaveLength(plan.pieceCount);
    expect(plan.pieceCount).toBe(open ? 2 : 1);
    // Open, the centre seam has nowhere clear to go across the channel's rails.
    expect(built.blockedSeams).toBe(plan.blockedSeams);
    expect(plan.blockedSeams).toBe(open ? 1 : 0);
    for (const piece of built.pieces) {
      const box = boundingBox(piece.vertices);
      expect(box.maxX - box.minX).toBeLessThanOrEqual(bed.width);
    }
  });

  it('keeps a channel whole by moving the seam behind its pocket', async () => {
    const innerW = 4 * 42 - GRIDFINITY.TOLERANCE - 2 * DEFAULT_BIN_PARAMS.wallThickness;
    const params: BinParams = {
      ...rail(false),
      cutouts: [
        cutout({ id: 'a', shape: 'rectangle', x: 2, y: 10, width: 20, depth: 15 }),
        cutout({
          id: 'b',
          shape: 'rectangle',
          x: innerW / 2 - 12,
          y: 10,
          width: 10,
          depth: 15,
          openSides: [{ side: 'right' }],
        }),
      ],
    };
    const plan = planFitTestOutlineSplit(params, bed, getSplitPlanePositionsMm, WALL);
    const built = await outline(params, { ...defaultSize, bed });

    expect(built.pieces).toHaveLength(2);
    expect(built.blockedSeams).toBe(0);
    expect(plan.blockedSeams).toBe(0);
    // Pocket b's ring starts a ring width left of the pocket and its rails run
    // on to the board edge, all on one piece.
    const right = built.pieces
      .map((p) => boundingBox(p.vertices))
      .reduce((a, b) => (a.maxX > b.maxX ? a : b));
    const binRight = boundingBox(getGenerateBin()(params, undefined, true).vertices).maxX;
    expect(right.minX).toBeCloseTo(-12 - WALL, 1);
    expect(right.maxX).toBeCloseTo(binRight, 1);
  });
});
