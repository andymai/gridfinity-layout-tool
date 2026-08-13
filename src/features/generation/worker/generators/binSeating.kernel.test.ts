// @vitest-environment node
/**
 * The foot lattice is only meaningful if the bin actually drops into a plate,
 * so this mates the two real solids and measures it (#3467).
 *
 * A 2x2 bin on a 4x4 plate, at three placements. On-grid the bin's edges land
 * on cell boundaries; a 21mm shift puts them mid-cell, which is what half-bin
 * mode places. Each lattice seats at exactly one of those, which is the whole
 * reason the setting exists — and why it is per axis.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import { seatDepth, type Placement } from './__kernel-tests__/binSeating';
import type { FootLattice } from './socketBuilder';

let generateBin: (params: BinParams) => MeshData;
let generateBaseplate: (
  params: ResolvedBaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean
) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
  generateBaseplate = (await import('./baseplateGenerator')).generateBaseplate;
}, 60000);

/** Pocket depth: a bin that drops all the way reaches this. */
const POCKET_DEPTH = 5;
/** Seated: within half a probe step of the pocket floor. */
const SEATED_MM = 4;
/** Perched: stopped near the top face, sitting proud. */
const PROUD_MM = 2;

const HALF_UNIT = 21;

function bin(latticeX: FootLattice, latticeY: FootLattice, halfSockets = false): MeshData {
  return generateBin({
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    base: {
      ...DEFAULT_BIN_PARAMS.base,
      halfSockets,
      footLatticeX: latticeX,
      footLatticeY: latticeY,
    },
  });
}

let plate: MeshData;
function plateMesh(): MeshData {
  plate ??= generateBaseplate(
    {
      width: 4,
      depth: 4,
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
    },
    () => {},
    false
  );
  return plate;
}

const ON_GRID: Placement = { dx: 0, dy: 0 };
const HALF_X: Placement = { dx: HALF_UNIT, dy: 0 };
const HALF_BOTH: Placement = { dx: HALF_UNIT, dy: HALF_UNIT };

describe('bin seating on a baseplate (#3467)', () => {
  it('the probe sees a plain bin drop into its pockets on-grid', () => {
    // Baseline: if this ever fails the probe is wrong, not the lattice.
    const { mm } = seatDepth(bin('grid', 'grid'), plateMesh(), ON_GRID);
    expect(mm).toBeGreaterThanOrEqual(SEATED_MM);
    expect(mm).toBeLessThanOrEqual(POCKET_DEPTH + 0.5);
  }, 120000);

  it('a plain bin perches on the ridges when placed half a unit off', () => {
    const { mm } = seatDepth(bin('grid', 'grid'), plateMesh(), HALF_BOTH);
    expect(mm).toBeLessThanOrEqual(PROUD_MM);
  }, 120000);

  it('the half lattice drops in at a half offset', () => {
    const { mm } = seatDepth(bin('half', 'half'), plateMesh(), HALF_BOTH);
    expect(mm).toBeGreaterThanOrEqual(SEATED_MM);
  }, 120000);

  it('the half lattice perches when the bin is on-grid', () => {
    // The setting is placement-dependent in both directions — this is why the
    // designer warns when it disagrees with where the bin sits.
    const { mm } = seatDepth(bin('half', 'half'), plateMesh(), ON_GRID);
    expect(mm).toBeLessThanOrEqual(PROUD_MM);
  }, 120000);

  it('mixed axes seat a bin offset on X but on-grid on Y', () => {
    // The reason the lattice is per axis: one layout on both axes perches on
    // whichever axis it got wrong.
    expect(seatDepth(bin('half', 'grid'), plateMesh(), HALF_X).mm).toBeGreaterThanOrEqual(
      SEATED_MM
    );
    expect(seatDepth(bin('half', 'half'), plateMesh(), HALF_X).mm).toBeLessThanOrEqual(PROUD_MM);
    expect(seatDepth(bin('grid', 'grid'), plateMesh(), HALF_X).mm).toBeLessThanOrEqual(PROUD_MM);
  }, 240000);

  it('half sockets seat at either offset — the placement-agnostic layout', () => {
    expect(seatDepth(bin('grid', 'grid', true), plateMesh(), ON_GRID).mm).toBeGreaterThanOrEqual(
      SEATED_MM
    );
    expect(seatDepth(bin('grid', 'grid', true), plateMesh(), HALF_BOTH).mm).toBeGreaterThanOrEqual(
      SEATED_MM
    );
  }, 240000);
});
