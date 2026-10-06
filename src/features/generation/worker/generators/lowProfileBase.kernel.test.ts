// @vitest-environment node
/**
 * The low-profile base is a claim about how parts mate, and only mated solids
 * can check it. Each part on its own is watertight and correctly sized whether
 * or not a stock bin rattles in the plate, so every case here lowers a real bin
 * into a real plate (or onto a real bin) and reads where it comes to rest.
 *
 * The numbers are measurements, never derived from the profiles under test:
 * recomputing them from `footProfileFor` would only prove the arithmetic agrees
 * with itself.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { lidStackGridHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import { stackJunctionMm } from '@/shared/utils/heightUnits';
import { initTestKernel } from '@/test/initTestKernel';
import { descentLimitAt, seatDepth } from './__kernel-tests__/binSeating';
import { stackSeat } from './__kernel-tests__/binStacking';
import {
  assertKernelReturnedGeometry,
  boundingBox,
  columnCrossings,
  isSolidThrough,
} from './__kernel-tests__/meshAssertions';

let generateBin: (params: BinParams, onProgress: undefined, forExport: boolean) => MeshData;
let generateBaseplate: (
  params: ResolvedBaseplateParams,
  onProgress: () => void,
  forExport: boolean
) => MeshData;
let generateLid: (params: BinParams) => MeshData | null;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
  generateBaseplate = (await import('./baseplateGenerator')).generateBaseplate;
  generateLid = (await import('./lidOrchestrator')).generateLid;
}, 60000);

/** Faceting slack on a taper-on-taper seat, where curved corners mate. */
const TAPER_TOLERANCE_MM = 0.05;

/** A bin landing on a flat floor reads exactly; this is float noise. */
const FLOOR_TOLERANCE_MM = 0.005;

const STOCK_IN_STANDARD_MM = 4.65;
const ON_LOW_FLOOR_MM = 3.55;
/**
 * A low foot never reaches a standard plate's floor: it settles on the pocket
 * taper, 0.75mm up. Resting on the ridge crest between two pockets instead
 * reads 3.65, which is what a multi-cell bin did before its underside relief.
 */
const LOW_IN_STANDARD_MM = 3.9;
const RIDGE_PERCH_MM = 3.65;

/** Side play at which every pairing still reaches the floor, and just past it. */
const PLAY_MM = 0.24;
const PAST_PLAY_MM = 0.26;

const meshes = new Map<string, MeshData>();

/** A 2x1 bin: two feet, so the ridge between their pockets is in play. */
function bin(low: boolean): MeshData {
  const key = `bin:${low}`;
  let mesh = meshes.get(key);
  if (!mesh) {
    // Export fidelity: the preview meshes the socket separately, and the
    // coincident faces that leaves flip `verticalSolidSpans`' parity.
    mesh = generateBin(
      {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 1,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, ...(low ? { lowProfile: true } : {}) },
      },
      undefined,
      true
    );
    assertKernelReturnedGeometry(mesh, key);
    meshes.set(key, mesh);
  }
  return mesh;
}

/** A floored plate, so a bin that reaches the floor stops on it as in a drawer. */
function plate(low: boolean): MeshData {
  const key = `plate:${low}`;
  let mesh = meshes.get(key);
  if (!mesh) {
    mesh = generateBaseplate(
      {
        width: 2,
        depth: 1,
        gridUnitMm: 42,
        magnetHoles: false,
        magnetDiameter: 6.5,
        magnetDepth: 2.4,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        fractionalEdgeX: 'end',
        fractionalEdgeY: 'end',
        lightweight: false,
        solidFloor: true,
        solidFloorThickness: 1,
        ...(low ? { lowProfileBase: true } : {}),
      },
      () => {},
      false
    );
    assertKernelReturnedGeometry(mesh, key);
    meshes.set(key, mesh);
  }
  return mesh;
}

const ON_GRID = { dx: 0, dy: 0 };

const PUSHED_WALL_STRIP_MM = 5;

/**
 * Seat depth with the bin pushed `dx` toward +X, probed column by column across
 * the pushed wall. The contact strip there is a fraction of a millimetre wide,
 * which `seatDepth`'s coarse sweep steps straight over.
 */
function pushedSeat(b: MeshData, p: MeshData, dx: number): number {
  const plateBox = boundingBox(p.vertices);
  const dz = plateBox.maxZ - boundingBox(b.vertices).minZ;
  let worst = Infinity;
  for (let x = plateBox.maxX - PUSHED_WALL_STRIP_MM; x <= plateBox.maxX; x += 0.01) {
    worst = Math.min(worst, descentLimitAt(b, p, x, 0, { dx, dy: 0 }, dz));
  }
  return worst;
}

describe('low-profile base: bin in plate', () => {
  it('seats a stock bin on a standard plate floor', () => {
    expect(seatDepth(bin(false), plate(false), ON_GRID).mm).toBeCloseTo(STOCK_IN_STANDARD_MM, 2);
  }, 120000);

  it('seats a low bin on a low plate floor', () => {
    const { mm } = seatDepth(bin(true), plate(true), ON_GRID);
    expect(Math.abs(mm - ON_LOW_FLOOR_MM)).toBeLessThan(FLOOR_TOLERANCE_MM);
  }, 120000);

  it('seats a stock bin on a low plate floor', () => {
    const { mm } = seatDepth(bin(false), plate(true), ON_GRID);
    expect(Math.abs(mm - ON_LOW_FLOOR_MM)).toBeLessThan(FLOOR_TOLERANCE_MM);
  }, 120000);

  it('seats a low bin on a standard plate by its tapers, not the ridge', () => {
    const { mm } = seatDepth(bin(true), plate(false), ON_GRID);
    expect(Math.abs(mm - LOW_IN_STANDARD_MM)).toBeLessThan(TAPER_TOLERANCE_MM);
    expect(mm).toBeGreaterThan(RIDGE_PERCH_MM + 0.1);
  }, 120000);

  it('holds a stock bin in a low plate to the same side play as a standard one', () => {
    // Past the play, a stock foot catches the low pocket's vertical wall and
    // hangs on it. That wall is what a bottom-cut low profile would not have.
    expect(pushedSeat(bin(false), plate(true), PLAY_MM)).toBeCloseTo(ON_LOW_FLOOR_MM, 2);
    expect(pushedSeat(bin(false), plate(false), PLAY_MM)).toBeCloseTo(STOCK_IN_STANDARD_MM, 2);
    expect(pushedSeat(bin(false), plate(true), PAST_PLAY_MM)).toBeLessThan(ON_LOW_FLOOR_MM - 0.5);
  }, 120000);
});

describe('low-profile base: the bin itself', () => {
  it('keeps the total height and drops the interior floor by the band cut', () => {
    const stock = bin(false);
    const low = bin(true);
    expect(boundingBox(low.vertices).maxZ).toBeCloseTo(boundingBox(stock.vertices).maxZ, 3);
    // Lowest crossing above the foot at a cell centre: the interior floor.
    const floorTop = (m: MeshData): number => columnCrossings(m, 21, 0)[1];
    expect(floorTop(stock) - floorTop(low)).toBeCloseTo(1.1, 2);
  }, 120000);

  it('runs the outer wall flush into the feet, with no groove above them', () => {
    // 0.05mm inside each wall, over a foot's straight edge: the foot's taper
    // starts 0.05 under its 3.65 top, so the column is solid from there up.
    const low = bin(true);
    const columns: ReadonlyArray<readonly [number, number]> = [
      [-30.37, -20.7],
      [-11.63, -20.7],
      [11.63, -20.7],
      [30.37, -20.7],
      [-30.37, 20.7],
      [30.37, 20.7],
      [-41.7, -8.41],
      [-41.7, 8.41],
      [41.7, -8.41],
      [41.7, 8.41],
    ];
    for (const [x, y] of columns) {
      expect(isSolidThrough(low, x, y, 3.62, 4.5), `${x},${y}`).toBe(true);
    }
  }, 120000);

  it('still lifts the underside clear of the crest between two feet', () => {
    expect(columnCrossings(bin(true), 0.03, -10.37)[0]).toBeGreaterThan(3.9);
  }, 120000);
});

describe('low-profile base: stacking', () => {
  it('sinks a low bin into a stock bin by its own foot depth', () => {
    expect(stackSeat(bin(true), bin(false)).junctionMm).toBeCloseTo(stackJunctionMm(true), 1);
  }, 180000);

  it('sinks a stock bin into a low bin by a stock foot depth', () => {
    expect(stackSeat(bin(false), bin(true)).junctionMm).toBeCloseTo(stackJunctionMm(false), 1);
  }, 180000);

  it('builds a low lid stack grid to the low height', () => {
    const lid = generateLid({
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, lowProfile: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
    });
    expect(lid).not.toBeNull();
    expect(boundingBox(lid?.vertices ?? new Float32Array()).maxZ).toBeCloseTo(
      lidStackGridHeightMm(true),
      2
    );
  }, 120000);
});
