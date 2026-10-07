// @vitest-environment node
/**
 * A bin that extends into the drawer margin must still seat on the plate that
 * fills that margin.
 *
 * The overhang is resolved from the plate's padding by the layout's own
 * resolver and handed to the generator the way the layout export does, then the
 * two real solids are mated with the foot resting on the pocket floor
 * (`baseplateSeatDepthMm`). The overhang is built on the body alone, so it
 * hangs above the margin rather than standing on the floor beside the feet.
 *
 * Each seated reading is paired with the same bin lowered by `PROBE_DROP_MM`,
 * deeper than the margin's clearance and shallower than the foot taper's slack.
 * A seated zero only means something if lowering the bin then hits the margin:
 * an overhang that missed the margin entirely would read zero both ways.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { StoredBaseplateParams } from '@/core/types';
import { mm } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { buildFullParams } from '@/features/baseplate/utils/buildFullParams';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { baseplateFloorDepth } from '@/shared/printSettings/baseplateHeight';
import { plateProfileHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import type { BinParams } from '@/shared/types/bin';
import { resolveBinMarginOverhang } from '@/shared/utils/drawerMargin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';

const GRID = 42;
const DRAWER = { width: 2, depth: 1 };
const BIN = { x: 0, y: 0, width: 1, depth: 1, extendToMargin: true };
const LEFT_MM = 12;
const FRONT_MM = 8;
const PADDING = {
  paddingLeft: mm(LEFT_MM),
  paddingRight: mm(0),
  paddingFront: mm(FRONT_MM),
  paddingBack: mm(0),
};

const PROBE_DROP_MM = 0.2;
/** Meshing noise on faces that touch without overlapping. */
const CONTACT_FLOOR_MM3 = 1;
/** 0.1mm of overlap across the ~900mm² of overhang reads ~90mm³. */
const LOWERED_HIT_MM3 = 20;

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

async function sharedVolume(a: Shape3D, b: Shape3D): Promise<number> {
  const { intersect, isErr, measureVolume, unwrap } = await import('brepjs');
  const hit = intersect(a as ValidSolid, b as ValidSolid, { optimisation: 'none' });
  if (isErr(hit)) {
    if (hit.error.code === 'INTERSECT_NOT_3D') return 0;
    throw new Error(`${hit.error.code}: ${hit.error.message}`);
  }
  try {
    return Math.abs(unwrap(measureVolume(hit.value)));
  } finally {
    hit.value.delete();
  }
}

interface Mated {
  readonly seated: number;
  readonly lowered: number;
  /** Bin material in the left margin below the plate's top face. */
  readonly inMargin: number;
}

async function mate(stored: StoredBaseplateParams, lowProfile = false): Promise<Mated> {
  const { translate, box } = await import('brepjs');
  const { getLastSolid } = await import('./shapeCache');
  const { buildBaseplateSolid } = await import('./baseplateGenerator');

  const plateParams = buildFullParams(
    stored,
    DRAWER.width,
    DRAWER.depth,
    GRID,
    'end',
    'end',
    undefined,
    undefined,
    undefined,
    GRID,
    0,
    0,
    lowProfile
  );
  const overhang = resolveBinMarginOverhang(BIN, DRAWER, stored);
  if (!overhang) throw new Error('expected the corner bin to extend');
  expect(overhang).toMatchObject({ left: LEFT_MM, front: FRONT_MM, right: 0, back: 0 });

  const binParams: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 1,
    height: 3,
    gridUnitMm: GRID,
    base: { ...DEFAULT_BIN_PARAMS.base, lowProfile },
    overhang,
  };
  getGenerateBin()(binParams, undefined, true);
  const binSolid = getLastSolid();
  if (!binSolid) throw new Error('expected an export solid');

  const plate = buildBaseplateSolid(plateParams, true);
  // The plate centres its grid on the origin, so cell (0,0) of the 2x1 grid
  // sits half a cell left of it; the bin is built centred on its footprint.
  const cellX = -GRID / 2;
  const seatZ = baseplateFloorDepth(plateParams);
  const plateTop = seatZ + plateProfileHeightMm(lowProfile);
  const seated = translate(binSolid, [cellX, 0, seatZ]);
  const lowered = translate(binSolid, [cellX, 0, seatZ - PROBE_DROP_MM]);
  const leftMargin = box(LEFT_MM, GRID + FRONT_MM, plateTop, {
    at: [cellX - GRID / 2 - LEFT_MM / 2, -FRONT_MM / 2, plateTop / 2],
  });
  try {
    return {
      seated: await sharedVolume(seated, plate),
      lowered: await sharedVolume(lowered, plate),
      inMargin: await sharedVolume(seated, leftMargin),
    };
  } finally {
    seated.delete();
    lowered.delete();
    leftMargin.delete();
    plate.delete();
  }
}

describe('a bin extended into the drawer margin seats on the padded plate', () => {
  it('hangs its overhang above a solid margin', async () => {
    const r = await mate({ ...DEFAULT_BASEPLATE_PARAMS, ...PADDING });
    expect(r.seated).toBeLessThan(CONTACT_FLOOR_MM3);
    expect(r.inMargin).toBeLessThan(CONTACT_FLOOR_MM3);
    expect(r.lowered).toBeGreaterThan(LOWERED_HIT_MM3);
  }, 120_000);

  it('hangs its overhang above a low-profile margin', async () => {
    // A low-profile underside is relieved by RIDGE_RELIEF_MM, so the lowered
    // probe never reaches this margin; only the seated reading applies.
    const r = await mate({ ...DEFAULT_BASEPLATE_PARAMS, ...PADDING }, true);
    expect(r.seated).toBeLessThan(CONTACT_FLOOR_MM3);
    expect(r.inMargin).toBeLessThan(CONTACT_FLOOR_MM3);
  }, 120_000);

  it('clears the margin of a magnet plate, whose pockets have a floor', async () => {
    const r = await mate({ ...DEFAULT_BASEPLATE_PARAMS, ...PADDING, magnetHoles: true });
    expect(r.seated).toBeLessThan(CONTACT_FLOOR_MM3);
  }, 120_000);

  it('drops its overhang feet into an over-tiled margin', async () => {
    const r = await mate({ ...DEFAULT_BASEPLATE_PARAMS, ...PADDING, overTile: true });
    expect(r.seated).toBeLessThan(CONTACT_FLOOR_MM3);
    expect(r.inMargin).toBeGreaterThan(LOWERED_HIT_MM3);
  }, 120_000);
});
