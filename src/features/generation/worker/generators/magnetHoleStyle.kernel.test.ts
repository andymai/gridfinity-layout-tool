// @vitest-environment node
/**
 * Real-kernel proof of the press-fit magnet hole options on every surface that
 * drills to the bin's magnet spec, plus the baseplate. Bounding boxes and
 * triangle counts cannot see a bore profile, so each case slices the mesh
 * through a hole and measures the wall radius around it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import {
  MAGNET_CHAMFER_MM,
  MAGNET_CRUSH_RIB_COUNT,
  MAGNET_CRUSH_RIB_DEPTH_MM,
} from '@/shared/generation/magnetHoleStyle';

type Mesh = { readonly vertices: Float32Array };

const R = 3.25;
const MAGNET = 13;

let generateBrepPlate: (
  params: ResolvedBaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean
) => Mesh;
let generateDirectPlate: (
  params: ResolvedBaseplateParams,
  onProgress: (stage: string, progress: number) => void
) => Mesh;
let generateLid: (params: BinParams, onProgress?: undefined, forExport?: boolean) => Mesh | null;

beforeAll(async () => {
  await initBrepjs();
  generateBrepPlate = (await import('./baseplateGenerator')).generateBaseplate;
  generateDirectPlate = (await import('./baseplateDirectMesh')).generateBaseplateDirect;
  generateLid = (await import('./lidOrchestrator')).generateLid;
}, 120_000);

/**
 * Wall radius around a hole centred at (cx, cy): the bore's z extent, the
 * radius range mid-bore, the number of rib peaks around it, and the widest
 * radius seen at each end of the bore (the chamfer mouth, if any).
 */
function holeProfile(mesh: Mesh, cx: number, cy: number) {
  const v = mesh.vertices;
  const near: Array<[number, number, number]> = [];
  for (let i = 0; i < v.length; i += 3) {
    const r = Math.hypot(v[i] - cx, v[i + 1] - cy);
    if (r < R + MAGNET_CHAMFER_MM + 0.4)
      near.push([r, v[i + 2], Math.atan2(v[i + 1] - cy, v[i] - cx)]);
  }
  const bore = near.filter(([r]) => r <= R + 0.05 && r >= R - MAGNET_CRUSH_RIB_DEPTH_MM - 0.1);
  const zs = bore.map(([, z]) => z);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  // Every bore vertex sits on the wall profile, including the end rings, and
  // a direct mesh has nothing but end rings.
  const band = bore;
  let rMin = Infinity;
  let rMax = 0;
  for (const [r] of band) {
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
  }
  // Mean error of the band against an n-rib cosine wave on the nominal bore;
  // the true rib count is the n that fits best, which a tessellated ring's
  // sparse vertices report far more reliably than counting local maxima.
  const half = MAGNET_CRUSH_RIB_DEPTH_MM / 2;
  const waveError = (n: number): number =>
    band.reduce((sum, [r, , a]) => sum + Math.abs(r - (R - half + half * Math.cos(n * a))), 0) /
    Math.max(1, band.length);
  // Widest ring at a plane, ignoring anything past the chamfer's own rim (a
  // lightweight pad's outer wall, for one). A chamfered mouth reads as the
  // rim radius on the face plane one chamfer beyond the bore's end.
  const ringAt = (z: number): number =>
    Math.max(
      0,
      ...near
        .filter(([r, vz]) => Math.abs(vz - z) < 0.02 && r < R + MAGNET_CHAMFER_MM + 0.15)
        .map(([r]) => r)
    );
  const mouthBelow = Math.max(ringAt(zMin), ringAt(zMin - MAGNET_CHAMFER_MM));
  const mouthAbove = Math.max(ringAt(zMax), ringAt(zMax + MAGNET_CHAMFER_MM));
  return { zMin, zMax, rMin, rMax, waveError, mouthBelow, mouthAbove };
}

function expectRibbed(p: ReturnType<typeof holeProfile>, label: string): void {
  expect(p.rMax, `${label} peaks on the bore`).toBeGreaterThan(R - 0.05);
  expect(p.rMin, `${label} troughs intrude`).toBeLessThan(R - MAGNET_CRUSH_RIB_DEPTH_MM + 0.07);
  expect(p.rMin, `${label} troughs stop at rib depth`).toBeGreaterThan(
    R - MAGNET_CRUSH_RIB_DEPTH_MM - 0.07
  );
  const fit = p.waveError(MAGNET_CRUSH_RIB_COUNT);
  expect(fit, `${label} follows the ${MAGNET_CRUSH_RIB_COUNT}-rib wave`).toBeLessThan(0.06);
  for (const n of [4, 6, 7, 9, 10, 12]) {
    expect(p.waveError(n), `${label} is not a ${n}-rib wave`).toBeGreaterThan(fit * 2);
  }
}

function expectPlainBore(p: ReturnType<typeof holeProfile>, label: string): void {
  expect(p.rMin, `${label} round bore`).toBeGreaterThan(R - 0.05);
  expect(p.rMax, `${label} round bore`).toBeLessThan(R + 0.05);
}

function expectChamferAt(width: number, label: string): void {
  expect(width, label).toBeGreaterThan(R + MAGNET_CHAMFER_MM - 0.05);
  expect(width, label).toBeLessThan(R + MAGNET_CHAMFER_MM + 0.1);
}

function magnetBin(overrides: Partial<BinParams['base']>, lid = false): BinParams {
  return buildParams({
    width: 1,
    depth: 1,
    height: 4,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', ...overrides },
    ...(lid
      ? { lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, magnetHoles: true } }
      : {}),
  });
}

describe('magnet hole press-fit options', () => {
  it('bin socket: plain bore by default', () => {
    const mesh = getGenerateBin()(magnetBin({}), undefined, true);
    const p = holeProfile(mesh, MAGNET, MAGNET);
    expectPlainBore(p, 'socket');
    expect(p.mouthBelow).toBeLessThan(R + 0.1);
  }, 120_000);

  it('bin socket: crush ribs wave the bore, chamfer opens the underside mouth', () => {
    const ribbed = holeProfile(
      getGenerateBin()(magnetBin({ magnetCrushRibs: true }), undefined, true),
      MAGNET,
      MAGNET
    );
    expectRibbed(ribbed, 'socket ribs');
    expect(ribbed.mouthBelow, 'ribs alone keep the plain mouth').toBeLessThan(R + 0.1);

    const both = holeProfile(
      getGenerateBin()(magnetBin({ magnetCrushRibs: true, magnetChamfer: true }), undefined, true),
      MAGNET,
      MAGNET
    );
    expectRibbed(both, 'socket ribs+chamfer');
    // The magnet enters from the underside (z = 0 after translation): the
    // bore starts one chamfer above it.
    expect(both.zMin - MAGNET_CHAMFER_MM).toBeCloseTo(0, 1);
    expectChamferAt(both.mouthBelow, 'socket chamfer mouth');
  }, 120_000);

  it('bin socket: the same options reach the preview mesh', () => {
    const p = holeProfile(
      getGenerateBin()(magnetBin({ magnetCrushRibs: true, magnetChamfer: true }), undefined, false),
      MAGNET,
      MAGNET
    );
    expectRibbed(p, 'socket preview');
    expectChamferAt(p.mouthBelow, 'socket preview chamfer');
  }, 120_000);

  it('lightweight base: ribs apply, the chamfer skips the thin pad', () => {
    const p = holeProfile(
      getGenerateBin()(
        magnetBin({ magnetCrushRibs: true, magnetChamfer: true, lightweight: true }),
        undefined,
        true
      ),
      MAGNET,
      MAGNET
    );
    expectRibbed(p, 'lightweight ribs');
    expect(p.mouthBelow, 'pad keeps its plain mouth').toBeLessThan(R + 0.1);
  }, 120_000);

  it('stackable lid top: ribs and chamfer, mouth on the lid face', () => {
    const lid = generateLid(
      magnetBin({ magnetCrushRibs: true, magnetChamfer: true }, true),
      undefined,
      true
    );
    expect(lid).not.toBeNull();
    if (!lid) return;
    const p = holeProfile(lid, MAGNET, MAGNET);
    expectRibbed(p, 'lid ribs');
    expectChamferAt(Math.max(p.mouthBelow, p.mouthAbove), 'lid chamfer mouth');
  }, 120_000);

  const plate = (overrides: Partial<ResolvedBaseplateParams>): ResolvedBaseplateParams => ({
    width: 1,
    depth: 1,
    gridUnitMm: 42,
    magnetHoles: true,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  });

  it('baseplate: ribs and chamfer in the exact plate and its direct-mesh draft alike', () => {
    const params = plate({ magnetCrushRibs: true, magnetChamfer: true });
    const brep = holeProfile(
      generateBrepPlate(params, () => {}, true),
      MAGNET,
      MAGNET
    );
    expectRibbed(brep, 'plate ribs');
    // The magnet enters from the pocket floor, the top of the bore.
    expectChamferAt(brep.mouthAbove, 'plate chamfer mouth');
    expect(brep.mouthBelow, 'plate bottom stays plain').toBeLessThan(R + 0.1);

    const draft = holeProfile(
      generateDirectPlate(params, () => {}),
      MAGNET,
      MAGNET
    );
    expectRibbed(draft, 'draft ribs');
    expectChamferAt(draft.mouthAbove, 'draft chamfer mouth');
    expect(Math.abs(draft.zMin - brep.zMin)).toBeLessThan(0.05);
    expect(Math.abs(draft.zMax - brep.zMax)).toBeLessThan(0.05);
  }, 120_000);

  it('baseplate: a lightweight plate keeps the ribs and skips the chamfer', () => {
    const p = holeProfile(
      generateBrepPlate(
        plate({ magnetCrushRibs: true, magnetChamfer: true, lightweight: true }),
        () => {},
        true
      ),
      MAGNET,
      MAGNET
    );
    expectRibbed(p, 'lightweight plate ribs');
    expect(p.mouthAbove, 'lightweight pad keeps its plain mouth').toBeLessThan(R + 0.1);
  }, 120_000);
});
