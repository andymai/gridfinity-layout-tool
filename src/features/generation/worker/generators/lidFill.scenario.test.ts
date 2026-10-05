/**
 * Lid fill: does the plug stop flush with the lid's mating edge, just
 * above the dividers, and does the lid still close?
 *
 * Both are read off the mated meshes. A plug a millimetre too deep is still a
 * watertight, plausibly sized lid; only seating it on its bin shows that it
 * props the lid open, and only a column through a divider shows the gap.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidFill.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import {
  binLipTopZ,
  lidSeatedZOffset,
  lidZOffset,
  magnetSeatGap,
  worstSeatInterference,
} from './__kernel-tests__/lidSeating';
import { LID_MAGNET_SEAT_GAP } from '@/shared/types/bin';
import { lidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
} from './retentionMagnetGeometry';
import { LIP_HEIGHT } from './generatorConstants';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout, LidConfig } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

beforeAll(async () => {
  await initBrepjs();
}, 180000);

/** A 2x2 bin split into four compartments, so dividers cross at the centre. */
function makeParams(lid: Partial<LidConfig>, over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    ...over,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, ...over.base },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'friction',
      fill: true,
      ...lid,
    },
  };
}

async function build(params: BinParams): Promise<{ bin: MeshData; lid: MeshData }> {
  const { generateLid } = await import('./lidOrchestrator');
  const bin = getGenerateBin()(params, undefined, false);
  const lid = generateLid(params);
  if (!bin) throw new Error('expected the bin to build');
  if (!lid) throw new Error('expected the lid to build');
  return { bin, lid };
}

/** Seated gap between the lid's underside and the bin's top surface at a column. */
function gapAt(bin: MeshData, lid: MeshData, dz: number, x: number, y: number): number {
  const binTop = columnCrossings(bin, x, y).at(-1);
  const lidBottom = columnCrossings(lid, x, y).at(0);
  if (binTop === undefined || lidBottom === undefined) {
    throw new Error(`no surface at (${x}, ${y})`);
  }
  return lidBottom + dz - binTop;
}

/**
 * Columns along both centre-line dividers, out to just inside the lip's
 * narrowest point on the 2x2 (2.6mm in from the 41.75mm outer face). Off the
 * exact centre line, which is a tessellation seam on both parts.
 */
const DIVIDER_COLUMNS: ReadonlyArray<readonly [number, number]> = [
  [0.1, 5],
  [0.1, 20],
  [0.1, 35],
  [0.1, 38.6],
  [-0.1, -38.6],
  [20, 0.1],
  [-38.6, -0.1],
];

describe('a filled lid fills its hollow flush with its mating edge', () => {
  const CASES: ReadonlyArray<readonly [string, Partial<LidConfig>, Partial<BinParams>]> = [
    ['friction', {}, {}],
    ['magnetic', { attachment: 'magnetic' }, {}],
    [
      'magnetic with edge magnets',
      { attachment: 'magnetic', retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 1 } },
      { width: 4, depth: 3 },
    ],
    ['deep cavity + thick plate', { topThicknessMm: 2.6, extraHeightMm: 8 }, {}],
    [
      'magnetic, deep cavity + thick plate',
      { attachment: 'magnetic', topThicknessMm: 2.6, extraHeightMm: 8 },
      {},
    ],
    ['exterior wall collar', {}, { extraWallHeightMm: 6 }],
    // Interior features that sit near the rim, which the plug must clear.
    [
      'label tabs and a scoop',
      {},
      {
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      },
    ],
  ];

  it.each(CASES)(
    '%s',
    async (_label, lidOver, over) => {
      const params = makeParams(lidOver, over);
      const { bin, lid } = await build(params);
      assertStructurallyValid(lid, 'filled lid');
      assertWatertight(lid, 'filled lid');
      const magnetic = params.lid.attachment === 'magnetic';

      // Flush: the magnet bosses' face, or the skirt's bottom, which is the
      // lowest thing on a friction lid.
      const plugBottom = columnCrossings(lid, 10, 10).at(0);
      if (plugBottom === undefined) throw new Error('no lid surface over the compartment');
      const edgeZ = magnetic ? bossFaceZ(lid, params) : boundingBox(lid.vertices).minZ;
      expect(plugBottom).toBeCloseTo(edgeZ, 2);

      // ...which is down near the dividers, not the old hollow ~5.7mm up.
      const dz = lidSeatedZOffset(params);
      for (const [x, y] of DIVIDER_COLUMNS) {
        const gap = gapAt(bin, lid, dz, x, y);
        expect(gap, `gap at (${x}, ${y})`).toBeGreaterThan(0.1);
      }
      if (!params.extraWallHeightMm) {
        expect(gapAt(bin, lid, dz, 0.1, 20)).toBeLessThan(1);
      }

      expectNoClash(bin, lid, params);
      if (magnetic) {
        expect(magnetSeatGap(bin, lid, params, dz)).toBeCloseTo(LID_MAGNET_SEAT_GAP, 1);
      }
    },
    300000
  );
});

describe('the bin keeps its divider ends whole', () => {
  it('skips the relief ring, so a divider meets the lip at full height', async () => {
    const filled = makeParams({});
    const open = makeParams({ fill: undefined });
    const { bin: filledBin } = await build(filled);
    const { bin: openBin } = await build(open);
    const wallTop = binLipTopZ(filled) - LIP_HEIGHT;

    // Just inboard of the lip's narrowest point, inside the relief ring's band.
    const filledTop = columnCrossings(filledBin, 0.1, 39).at(-1);
    const openTop = columnCrossings(openBin, 0.1, 39).at(-1);
    expect(filledTop).toBeCloseTo(wallTop, 1);
    expect(openTop).toBeLessThan(wallTop - 3);
  }, 300000);
});

describe('options the fill does not apply to', () => {
  it('leaves a click-rail lid hollow', async () => {
    const params = makeParams({ attachment: 'clickRails' });
    const { lid } = await build(params);
    const lidBottom = columnCrossings(lid, 10, 10).at(0);
    if (lidBottom === undefined) throw new Error('no lid surface');
    // Only the floor plate's underside: the cavity is still open.
    expect(lidBottom).toBeCloseTo(-params.lid.topThicknessMm, 1);
  }, 300000);
});

describe('lid cutouts on a filled lid', () => {
  it('cut through the plug as well as the plate', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const probe = makeParams({ cutouts: [rect(0, 0, 1, 1)] });
    const window = lidCutoutWindow(probe);
    if (!window) throw new Error('expected a cutout window');
    const w = 10;
    const d = 6;
    // Centred in compartment (+X, +Y), clear of both dividers.
    const cx = 20;
    const cy = 20;
    const slot = rect(
      cx - window.offsetX + window.spanW / 2 - w / 2,
      cy - window.offsetY + window.spanD / 2 - d / 2,
      w,
      d
    );
    const lid = generateLid(makeParams({ cutouts: [slot] }));
    if (!lid) throw new Error('expected the lid to build');
    assertWatertight(lid, 'filled lid with slot');
    expect(columnCrossings(lid, cx, cy)).toEqual([]);
    expect(columnCrossings(lid, cx, cy + d / 2 + 2).length).toBeGreaterThan(0);
  }, 300000);
});

function expectNoClash(bin: MeshData, lid: MeshData, params: BinParams): void {
  const clash = worstSeatInterference(bin, lid, lidZOffset(params));
  expect(
    clash.mm,
    `${clash.mm.toFixed(2)}mm of bin and lid share a column at (${clash.x.toFixed(1)}, ${clash.y.toFixed(1)})`
  ).toBeLessThan(0.01);
}

/**
 * Lid-local Z of a boss's magnet face, read in the solid ring around the pocket
 * — on the axis the pocket is hollow.
 */
function bossFaceZ(lid: MeshData, p: BinParams): number {
  const { diameter, edgeMagnets } = p.lid.retentionMagnet;
  const bossR = retentionBossRadius(diameter);
  const [first] = retentionMagnetPositions(
    p.width,
    p.depth,
    p.gridUnitMm,
    p.gridUnitMmY ?? p.gridUnitMm,
    retentionMagnetInset(diameter),
    edgeMagnets,
    bossR
  );
  const r = (diameter / 2 + bossR) / 2;
  const t = (30 * Math.PI) / 180;
  const z = columnCrossings(lid, first.x + r * Math.cos(t), first.y + r * Math.sin(t)).at(0);
  if (z === undefined) throw new Error('no boss surface');
  return z;
}

function rect(x: number, y: number, width: number, depth: number): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x,
    y,
    width,
    depth,
    cutDepth: 0.2,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}
