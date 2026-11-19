// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { drawRectangle, intersect, measureVolume, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { ResolvedBaseplateParams, MarginPiece } from '@/shared/types/bin';
import { mm, type StoredBaseplateParams } from '@/core/types';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { buildFullParams } from '@/features/baseplate/utils/buildFullParams';
import {
  bodyParamsForDetach,
  computeBaseplateTiling,
} from '@/features/baseplate/utils/splitPlanner';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  columnCrossings,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import { buildBaseplateSolid } from './baseplateGenerator';
import { sanitizeParams } from './baseplateSlab';
import { generateMargin } from './baseplateMargin';
import { computeCellCentersMm } from './cellDecomposition';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const GU = 42;
const WIDTH_UNITS = 2.5;
const DEPTH_UNITS = 2;
const ECO_BRIDGE_MM = 1.6;

function plate(over: Partial<StoredBaseplateParams> = {}): ResolvedBaseplateParams {
  const stored: StoredBaseplateParams = {
    ...DEFAULT_BASEPLATE_PARAMS,
    paddingLeft: mm(9),
    paddingRight: mm(0),
    paddingFront: mm(12),
    paddingBack: mm(15),
    overTile: true,
    detachMargins: true,
    ecoPlate: true,
    ...over,
  };
  return buildFullParams(stored, WIDTH_UNITS, DEPTH_UNITS, GU, 'end', 'end', 0.4);
}

function railsOf(params: ResolvedBaseplateParams, bedMm = 500): readonly MarginPiece[] {
  const rails = computeBaseplateTiling(params, bedMm, bedMm).margins;
  expect(rails.length, 'detached rails').toBeGreaterThan(0);
  return rails;
}

function railSize(rail: MarginPiece): { w: number; d: number } {
  const horizontal = rail.side === 'front' || rail.side === 'back';
  return horizontal
    ? { w: rail.lengthMm, d: rail.bandThicknessMm }
    : { w: rail.bandThicknessMm, d: rail.lengthMm };
}

function volumeOf(shape: Shape3D): number {
  return unwrap(measureVolume(shape));
}

/** The integral plate's material inside one rail's footprint, in mm³. */
function volumeUnder(integral: Shape3D, rail: MarginPiece): number {
  const { w, d } = railSize(rail);
  const prism = (
    drawRectangle(w, d).sketchOnPlane('XY', -1) as { extrude: (h: number) => Shape3D }
  ).extrude(50);
  const window = translate(prism, [rail.worldOffsetMm.x, rail.worldOffsetMm.y, 0]);
  prism.delete();
  const inside = unwrap(intersect(integral, window));
  const volume = volumeOf(inside);
  inside.delete();
  window.delete();
  return volume;
}

/** Highest surface over a column, or -Infinity where the column is open. */
function topAt(m: MeshData, x: number, y: number): number {
  const c = columnCrossings(m, x, y);
  return c.length > 0 ? c[c.length - 1] : -Infinity;
}

describe('an eco plate relieves its detached margins', () => {
  const cases: Array<[string, Partial<StoredBaseplateParams>, number]> = [
    ['grid margins', {}, 500],
    ['half-grid margins', { overTileHalfGrid: true, paddingBack: mm(30) }, 500],
    ['solid margins', { overTile: false }, 500],
    // Under half the narrowest rail's band, so rail and plate round it alike,
    // and wide enough to reach the relief beside it.
    ['grid margins with a rounded corner', { cornerRadius: mm(5) }, 500],
    ['grid margins on a split plate', {}, 90],
  ];
  it.each(cases)(
    'cuts each rail as the integral plate cuts the same band (%s)',
    (_label, over, bedMm) => {
      const eco = plate(over);
      const plain = plate({ ...over, ecoPlate: false });
      const integralEco = buildBaseplateSolid(
        sanitizeParams(plate({ ...over, detachMargins: false })),
        true
      );
      const integralPlain = buildBaseplateSolid(
        sanitizeParams(plate({ ...over, detachMargins: false, ecoPlate: false })),
        true
      );
      try {
        for (const rail of railsOf(eco, bedMm)) {
          const relieved = generateMargin(eco, rail, true);
          assertStructurallyValid(relieved, rail.id);
          assertWatertight(relieved, rail.id);
          const railRemoved = meshVolume(generateMargin(plain, rail, true)) - meshVolume(relieved);
          const integralRemoved = volumeUnder(integralPlain, rail) - volumeUnder(integralEco, rail);
          expect(
            integralRemoved,
            `${rail.id}: the integral plate relieves this band`
          ).toBeGreaterThan(50);
          expect(railRemoved, `${rail.id}: eco material removed`).toBeCloseTo(integralRemoved, -1);
        }
      } finally {
        integralEco.delete();
        integralPlain.delete();
      }
    },
    120_000
  );

  it('drops a grid margin wall to the bottom bridge', () => {
    const eco = plate();
    const plain = plate({ ecoPlate: false });
    const back = railsOf(eco).find((r) => r.side === 'back');
    if (!back) throw new Error('no back rail');
    const relieved = generateMargin(eco, back, true);
    const full = generateMargin(plain, back, true);
    const top = boundingBox(full.vertices).maxZ;
    // Over the outer wall of each margin cell along the body, 0.3mm in from the
    // plate edge.
    const y = back.bandThicknessMm / 2 - 0.3;
    for (const c of computeCellCentersMm(WIDTH_UNITS, GU, 'end')) {
      const x = c - back.worldOffsetMm.x;
      expect(topAt(full, x, y), `plain wall at x=${c}`).toBeGreaterThan(top - 1);
      expect(topAt(relieved, x, y), `eco wall at x=${c}`).toBeCloseTo(ECO_BRIDGE_MM, 1);
    }
  });

  it.each([8, 9])('keeps a %d mm rail printable', (band) => {
    const fills: Array<Partial<StoredBaseplateParams>> = [
      {},
      { overTile: false },
      { overTileHalfGrid: true },
    ];
    for (const over of fills) {
      const eco = plate({
        ...over,
        paddingLeft: mm(band),
        paddingFront: mm(band),
        paddingBack: mm(band),
      });
      for (const rail of railsOf(eco)) {
        const m = generateMargin(eco, rail, true);
        assertStructurallyValid(m, `${rail.id} ${JSON.stringify(over)}`);
        assertWatertight(m, `${rail.id} ${JSON.stringify(over)}`);
      }
    }
  });
});

describe('an eco plate keeps the margin seam connectors whole', () => {
  // A column 0.5mm inside the seam face: the wall a tongue grows from, or the
  // wall a groove is cut into, must stand at full height, not at the bridge.
  const INSIDE = 0.5;
  // Beside a groove, clear of its widest point and its clearance.
  const BESIDE = 2.7;

  it.each([
    ['body tongues', false],
    ['rail tongues', true],
  ] as const)('keeps the seam walls at each connector (%s)', (_label, inverted) => {
    const params = plate({
      detachMarginConnector: true,
      connectorStyle: 'puzzle',
      ...(inverted ? { connectorNubs: true, invertDovetails: true } : {}),
    });
    const tiling = computeBaseplateTiling(params, 500, 500);
    const body = getGenerateBaseplate()(bodyParamsForDetach(params), () => undefined, true);
    const halfD = (DEPTH_UNITS * GU) / 2;
    const back = tiling.margins.find((r) => r.side === 'back');
    if (!back) throw new Error('no back rail');
    const rail = generateMargin(params, back, true);
    const tongueOn = inverted ? 'rail' : 'body';
    for (const c of computeCellCentersMm(WIDTH_UNITS, GU, 'end')) {
      const bodyX = tongueOn === 'body' ? c : c + BESIDE;
      expect(
        topAt(body, bodyX, halfD - INSIDE),
        `body seam wall at x=${bodyX.toFixed(1)}`
      ).toBeGreaterThan(3);
      const railX = (tongueOn === 'rail' ? c : c + BESIDE) - back.worldOffsetMm.x;
      const railY = -back.bandThicknessMm / 2 + INSIDE;
      expect(
        topAt(rail, railX, railY),
        `rail seam wall at x=${(railX + back.worldOffsetMm.x).toFixed(1)}`
      ).toBeGreaterThan(3);
    }
  });
});
