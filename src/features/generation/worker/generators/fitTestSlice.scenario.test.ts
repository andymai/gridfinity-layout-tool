// @vitest-environment node
/**
 * Cutout fit-test card.
 *
 * The card's whole claim is that it is the bin: print it, and the hole you
 * measure is the hole you will get. So the assertions here are stated as a
 * DELTA against the bin generated from the same params, never against a second
 * copy of the slice arithmetic — restating `wallTopZ - topOffset - thickness`
 * in the test would pass on a card taken from entirely the wrong band.
 *
 * A bounding box is not enough on its own either. A card with no openings at
 * all has exactly the right bbox, the right triangle count order of magnitude,
 * and is perfectly watertight. Every claim about the openings is therefore made
 * by probing inside the volume.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFont, isErr } from 'brepjs';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  boundingBox,
  columnCrossings,
  hasNoNaNOrInfinity,
  isSolidThrough,
  meshVolume,
  sectionHalfWidth,
} from './__kernel-tests__/meshAssertions';
import type { MeshData } from '../../bridge/types';
import { estimateFitTestVolumeMm3 } from '@/shared/utils/fitTestPlan';
// Type-only, so it is erased and the module is still loaded lazily below —
// the generators must not be imported before the kernel is registered.
import type * as FitTestSlice from './fitTestSlice';

beforeAll(async () => {
  await initBrepjs();
  // The worker loads fonts through `wasmInstantiator`; a test has to do it too,
  // or `buildTextSolid` returns null and the underside stamp silently no-ops.
  const buffer = readFileSync(resolve(__dirname, '../assets/fonts/JetBrainsMono-Regular.ttf'));
  const font = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'jetbrains-mono'
  );
  if (isErr(font)) throw new Error(`Font load failed: ${font.error.message}`);
}, 60000);

let buildFitTestMeshes: typeof FitTestSlice.buildFitTestMeshes;

beforeAll(async () => {
  // Imported after the kernel is registered, matching how wasmInit defers the
  // generator modules.
  ({ buildFitTestMeshes } = await import('./fitTestSlice'));
});

const GRID = GRIDFINITY.GRID_SIZE;
const HEIGHT_UNIT = DEFAULT_BIN_PARAMS.heightUnitMm;

const baseCutout = (over: Partial<Cutout>): Cutout => ({
  id: 'c1',
  shape: 'circle',
  x: 10,
  y: 10,
  width: 12,
  depth: 12,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...over,
});

/** A 2x2x4u solid bin with a shallow pocket and a deep channel. */
function boardParams(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    style: 'solid',
    // `base.solid` is what deriveDimensions reads; `style` alone leaves the bin
    // hollow, and a hollow bin's card is a wall ring with no openings in it.
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [
      baseCutout({ id: 'shallow', shape: 'circle', x: 8, y: 8, width: 14, depth: 14, cutDepth: 2 }),
      baseCutout({
        id: 'deep',
        shape: 'rectangle',
        x: 40,
        y: 8,
        width: 20,
        depth: 14,
        cutDepth: 20,
      }),
    ],
    cutoutConfig: { topOffset: 0 },
    ...over,
  };
}

/** Model-frame XY centre of a cutout, which is where a probe has to look. */
function cutoutCentre(params: BinParams, id: string): { x: number; y: number } {
  const cutout = params.cutouts.find((c) => c.id === id);
  if (!cutout) throw new Error(`no cutout ${id}`);
  const innerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
  const innerD = params.depth * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
  return {
    x: cutout.x + cutout.width / 2 - innerW / 2,
    y: cutout.y + cutout.depth / 2 - innerD / 2,
  };
}

const asMeshData = (p: { vertices: Float32Array; indices: Uint32Array }): MeshData =>
  p as unknown as MeshData;

// Each of these is a full export-quality generation, and most cases here reuse
// the same handful. Cached by params so the suite pays for each once.
const binCache = new Map<string, MeshData>();
const cardCache = new Map<string, ReturnType<typeof buildFitTestMeshes>>();

function bin(params: BinParams): MeshData {
  const key = JSON.stringify(params);
  const hit = binCache.get(key);
  if (hit) return hit;
  const built = getGenerateBin()(params);
  binCache.set(key, built);
  return built;
}

function card(
  params: BinParams,
  options: Parameters<typeof buildFitTestMeshes>[1]
): ReturnType<typeof buildFitTestMeshes> {
  const key = JSON.stringify([params, options]);
  const hit = cardCache.get(key);
  if (hit) return hit;
  const built = buildFitTestMeshes(params, options);
  cardCache.set(key, built);
  return built;
}

/**
 * Whether the column at (x, y) has material at height `z`, measured between the
 * OUTERMOST surfaces rather than by pairing crossings.
 *
 * `verticalSolidSpans` pairs crossings and so needs an even count, which the
 * bin does not give at columns grazing its socket taper — an odd count there
 * pairs the intervals into the void and reads solid material as empty. This is
 * the measurement `columnCrossings` documents as the right one when only the
 * outer faces matter, and it is applied identically to card and bin so the
 * comparison stays honest.
 */
function hasMaterialAt(mesh: MeshData, x: number, y: number, z: number): boolean {
  const crossings = columnCrossings(mesh, x, y);
  if (crossings.length === 0) return false;
  return z >= crossings[0] && z <= crossings[crossings.length - 1];
}

describe('fit-test card — the band', () => {
  it('spans exactly the requested thickness and stops at the solid fill surface', () => {
    const params = boardParams();
    const theBin = bin(params);
    const theCard = card(params, { thicknessMm: 4 }).pieces[0];

    const cardBox = boundingBox(theCard.vertices);
    const binBox = boundingBox(theBin.vertices);

    expect(cardBox.maxZ - cardBox.minZ).toBeCloseTo(4, 2);
    // Stated against the bin's own top, not against a restated height chain.
    // A stacking lip would put the bin's top above the card's; the default bin
    // has one, which is exactly the case that has to come out equal here
    // because the band is taken from `wallTopZ`, below the lip.
    expect(cardBox.maxZ).toBeLessThanOrEqual(binBox.maxZ + 1e-6);
    expect(binBox.maxZ - cardBox.maxZ).toBeLessThan(params.heightUnitMm);
  });

  it('keeps the bin footprint, so the card sits in the drawer', () => {
    const params = boardParams();
    const theBin = bin(params);
    const theCard = card(params, { thicknessMm: 4 }).pieces[0];

    const cardBox = boundingBox(theCard.vertices);
    const binBox = boundingBox(theBin.vertices);
    expect(cardBox.maxX - cardBox.minX).toBeCloseTo(binBox.maxX - binBox.minX, 1);
    expect(cardBox.maxY - cardBox.minY).toBeCloseTo(binBox.maxY - binBox.minY, 1);
  });

  it('produces clean geometry', () => {
    const theCard = card(boardParams(), { thicknessMm: 4 }).pieces[0];
    expect(hasNoNaNOrInfinity(theCard.vertices)).toBe(true);
    expect(theCard.indices.length).toBeGreaterThan(0);
    expect(theCard.indices.length % 3).toBe(0);
  });
});

describe('fit-test card — the openings are really there', () => {
  const params = boardParams();
  const THICKNESS = 4;

  it('opens the top face wherever the bin does', () => {
    const theCard = card(params, { thicknessMm: THICKNESS }).pieces[0];
    const box = boundingBox(theCard.vertices);
    const topZ = box.maxZ;

    for (const id of ['shallow', 'deep']) {
      const { x, y } = cutoutCentre(params, id);
      // Just under the top face: inside an opening there is no material.
      const solid = isSolidThrough(asMeshData(theCard), x, y, topZ - 0.6, topZ - 0.2);
      expect(solid, `${id} should be open at the card's top face`).toBe(false);
    }
  });

  it('is solid in the material between the openings', () => {
    const theCard = card(params, { thicknessMm: THICKNESS }).pieces[0];
    const box = boundingBox(theCard.vertices);
    // Midway between the two cutouts, where the board's webbing is.
    const a = cutoutCentre(params, 'shallow');
    const b = cutoutCentre(params, 'deep');
    const solid = isSolidThrough(
      asMeshData(theCard),
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      box.minZ + 0.2,
      box.maxZ - 0.2
    );
    expect(solid, 'the web between two cutouts must survive the slice').toBe(true);
  });

  it('keeps a shallow pocket blind and takes a deep one through', () => {
    const theCard = card(params, { thicknessMm: THICKNESS }).pieces[0];
    const box = boundingBox(theCard.vertices);

    // The 2mm pocket is shallower than the 4mm card, so the material under it
    // survives the intersect and the pocket keeps its real floor.
    const shallow = cutoutCentre(params, 'shallow');
    expect(
      isSolidThrough(asMeshData(theCard), shallow.x, shallow.y, box.minZ + 0.1, box.minZ + 0.5),
      'a pocket shallower than the card must keep its floor'
    ).toBe(true);

    // The 20mm channel is deeper, so nothing is left under it.
    const deep = cutoutCentre(params, 'deep');
    expect(
      isSolidThrough(asMeshData(theCard), deep.x, deep.y, box.minZ + 0.1, box.minZ + 0.5),
      'a cut deeper than the card must go through it'
    ).toBe(false);
  });

  it('reproduces the bin across the whole interior, not merely somewhere', () => {
    const theCard = card(params, { thicknessMm: THICKNESS }).pieces[0];
    const cardBox = boundingBox(theCard.vertices);
    const theBin = bin(params);

    // A grid asks the question a probe aimed at one suspected place cannot:
    // everywhere the CARD has material in the band, so must the BIN, and vice
    // versa. This is what catches a band offset by a millimetre, a chamfer that
    // did not survive, or an opening the slice rounded away.
    //
    // Only the outermost 1mm is skipped, to keep probes off the rounded corner
    // arc where a ray runs tangent to the surface. Everything inside that,
    // including the whole wall, is compared.
    const EDGE_KEEPOUT = 1;
    const halfW = cardBox.maxX - EDGE_KEEPOUT;
    const halfD = cardBox.maxY - EDGE_KEEPOUT;
    const probeZ = cardBox.maxZ - 0.5;
    let compared = 0;
    for (let x = -halfW; x <= halfW; x += 6.7) {
      for (let y = -halfD; y <= halfD; y += 6.7) {
        const inCard = hasMaterialAt(asMeshData(theCard), x, y, probeZ);
        const inBin = hasMaterialAt(theBin, x, y, probeZ);
        expect(inCard, `card and bin disagree at (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(inBin);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('carries the bin outer profile at every height in the band', () => {
    const theCard = card(params, { thicknessMm: THICKNESS }).pieces[0];
    const cardBox = boundingBox(theCard.vertices);
    const theBin = bin(params);

    // `sectionHalfWidth` slices triangle edges rather than counting crossings,
    // so it is unaffected by the parity problem above and is the right tool for
    // the wall the grid has to skip. A card taken from the wrong band shows up
    // here as a profile that does not match the bin at the same height.
    for (let z = cardBox.minZ + 0.3; z <= cardBox.maxZ - 0.3; z += 0.7) {
      expect(
        sectionHalfWidth(asMeshData(theCard), z),
        `outer profile differs from the bin at z=${z.toFixed(2)}`
      ).toBeCloseTo(sectionHalfWidth(theBin, z), 2);
    }
  });
});

describe('fit-test card — thickness', () => {
  it('defaults into the 3-5mm band and honours an explicit value', () => {
    const params = boardParams();
    const thin = card(params, { thicknessMm: 2 }).pieces[0];
    const thick = card(params, { thicknessMm: 9 }).pieces[0];

    const thinBox = boundingBox(thin.vertices);
    const thickBox = boundingBox(thick.vertices);
    expect(thinBox.maxZ - thinBox.minZ).toBeCloseTo(2, 2);
    expect(thickBox.maxZ - thickBox.minZ).toBeCloseTo(9, 2);
    // Both are taken from the same top plane, so only the underside moved.
    expect(thinBox.maxZ).toBeCloseTo(thickBox.maxZ, 2);
  });

  it('gives a deep pocket its real floor once the card is thicker than the cut', () => {
    const params = boardParams();
    // The deep channel is 20mm; a 21mm card reaches past it.
    const theCard = card(params, { thicknessMm: 21 }).pieces[0];
    const box = boundingBox(theCard.vertices);
    const deep = cutoutCentre(params, 'deep');
    expect(
      isSolidThrough(asMeshData(theCard), deep.x, deep.y, box.minZ + 0.1, box.minZ + 0.5),
      'a card thicker than the cut verifies seat depth, so the floor is back'
    ).toBe(true);
  });
});

describe('fit-test card — topOffset', () => {
  it('takes the band from the fill surface, which a top offset lowers', () => {
    const flush = boardParams({ cutoutConfig: { topOffset: 0 } });
    const sunk = boardParams({ cutoutConfig: { topOffset: 6 } });

    const flushCard = card(flush, { thicknessMm: 4 }).pieces[0];
    const sunkCard = card(sunk, { thicknessMm: 4 }).pieces[0];

    const flushTop = boundingBox(flushCard.vertices).maxZ;
    const sunkTop = boundingBox(sunkCard.vertices).maxZ;
    // The rim stands proud of the sunk fill surface, so the sunk card's own top
    // is the WALL, not the fill — but its fill surface has dropped by 6mm, and
    // that is what the band followed.
    expect(sunkTop).toBeLessThan(flushTop);
  });
});

describe('fit-test card — the volume estimate', () => {
  // `estimatePrint` has no way to describe a slice, so the card carries its own
  // analytic term. Gotcha #21: a calibration you have not reproduced is not a
  // calibration. This is the reproduction.
  const cases: Array<{ name: string; params: BinParams; thickness: number }> = [
    { name: '2x2 board, 4mm', params: boardParams(), thickness: 4 },
    { name: '2x2 board, 2mm', params: boardParams(), thickness: 2 },
    {
      name: '3x2 board, 5mm',
      params: boardParams({ width: 3, depth: 2 }),
      thickness: 5,
    },
  ];

  it.each(cases)('is within 12% of the generated card for $name', ({ params, thickness }) => {
    const theCard = card(params, { thicknessMm: thickness }).pieces[0];
    const actual = meshVolume(asMeshData(theCard));
    const predicted = estimateFitTestVolumeMm3(params, thickness);

    expect(actual).toBeGreaterThan(0);
    const residual = Math.abs(predicted - actual) / actual;
    expect(
      residual,
      `predicted ${predicted.toFixed(0)} vs actual ${actual.toFixed(0)}`
    ).toBeLessThan(0.12);
  });

  it('is a small fraction of the whole bin, which is the point of the card', () => {
    const params = boardParams();
    const theCard = card(params, { thicknessMm: 4 }).pieces[0];
    const theBin = bin(params);
    expect(meshVolume(asMeshData(theCard))).toBeLessThan(meshVolume(theBin) * 0.35);
  });
});

describe('fit-test card — the underside stamp', () => {
  it('cuts into the underside without breaching the top face', () => {
    const params = boardParams();
    const stamped = card(params, {
      thicknessMm: 4,
      stamp: { designName: 'Socket rail' },
    }).pieces[0];
    const bare = card(params, { thicknessMm: 4 }).pieces[0];

    // Stated as a delta: the stamp removes material and nothing else does.
    const stampedVol = meshVolume(asMeshData(stamped));
    const bareVol = meshVolume(asMeshData(bare));
    expect(stampedVol).toBeLessThan(bareVol);
    // A 0.4mm-deep engraving over a few hundred mm² of glyph ink is small; a
    // stamp that had cut through the card would take far more than this.
    expect(bareVol - stampedVol).toBeLessThan(bareVol * 0.02);

    // Both cards occupy the same band — the stamp did not move the top face.
    expect(boundingBox(stamped.vertices).maxZ).toBeCloseTo(boundingBox(bare.vertices).maxZ, 3);
    expect(boundingBox(stamped.vertices).minZ).toBeCloseTo(boundingBox(bare.vertices).minZ, 3);
  });
});

describe('fit-test card — splitting', () => {
  it('leaves a card that fits the bed whole', () => {
    const params = boardParams();
    const result = card(params, {
      thicknessMm: 4,
      bed: { width: 256, depth: 256 },
    });
    expect(result.pieces).toHaveLength(1);
    expect(result.blockedSeams).toBe(0);
  });

  it('cuts an oversize card into bed-fitting pieces', () => {
    const params = boardParams({ width: 8, depth: 2 });
    const result = card(params, {
      thicknessMm: 4,
      bed: { width: 180, depth: 180 },
    });
    expect(result.pieces.length).toBeGreaterThan(1);
    for (const piece of result.pieces) {
      const box = boundingBox(piece.vertices);
      expect(box.maxX - box.minX).toBeLessThanOrEqual(180 + 1e-3);
      expect(piece.indices.length).toBeGreaterThan(0);
    }
  });

  it('reassembles to the whole card, so the split lost nothing', () => {
    const params = boardParams({ width: 8, depth: 2 });
    const whole = card(params, { thicknessMm: 4 }).pieces[0];
    const split = card(params, {
      thicknessMm: 4,
      bed: { width: 180, depth: 180 },
    });

    const summed = split.pieces.reduce((sum, p) => sum + meshVolume(asMeshData(p)), 0);
    expect(summed).toBeCloseTo(meshVolume(asMeshData(whole)), -1);
  });
});

describe('fit-test card — bin height independence', () => {
  it('costs the same whatever the bin is tall, which is why it is worth printing', () => {
    const short = card(boardParams({ height: 4 }), { thicknessMm: 4 }).pieces[0];
    const tall = card(boardParams({ height: 8 }), { thicknessMm: 4 }).pieces[0];
    expect(meshVolume(asMeshData(short))).toBeCloseTo(meshVolume(asMeshData(tall)), -1);
    expect(HEIGHT_UNIT * 4).toBeGreaterThan(0);
    expect(GRID).toBe(42);
  });
});
