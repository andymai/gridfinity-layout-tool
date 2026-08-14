// @vitest-environment node
/**
 * Per-compartment shadow-box colours, verified against real generated geometry.
 *
 * Compartment colours are classified SPATIALLY (`resolveCompartmentTriColor`),
 * not from a face tag, so the only honest check is to generate the bin and ask
 * which triangles the classifier actually claims. Asserting the rect arithmetic
 * against a second copy of itself would prove nothing about the mesh.
 *
 * What has to hold:
 *  - A coloured compartment claims floor triangles inside ITS OWN footprint and
 *    none inside its neighbour's.
 *  - `floor` scope claims no wall; `floorAndWalls` does.
 *  - The divider between two coloured compartments is claimed from BOTH sides —
 *    each face by the compartment it faces — which is the property the whole
 *    normal-probe approach exists for.
 *  - Nothing outside the cavity (the bin's underside, its rim) is ever claimed.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import {
  planCompartmentColors,
  resolveCompartmentTriColor,
} from '@/features/bin-designer/utils/compartmentColorUnits';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const LEFT = '#ff0000';
const RIGHT = '#0000ff';

/** 2x1 grid across a 2x1 bin: compartment 0 on the left, 1 on the right. */
function twoUp(overrides: Partial<BinParams['compartments']> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    height: 5,
    compartments: {
      cols: 2,
      rows: 1,
      thickness: 1.2,
      cells: [0, 1],
      compartmentColors: [LEFT, RIGHT],
      ...overrides,
    },
  };
}

interface Claim {
  readonly color: string | null;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly absNz: number;
}

/** Every rendered triangle, with the colour the classifier gives it. */
function claims(params: BinParams): Claim[] {
  const plan = planCompartmentColors(params);
  if (!plan) throw new Error('expected a colour plan');
  const mesh = getGenerateBin()(params);
  const v = mesh.vertices;
  const idx = mesh.indices;
  expect(v.length).toBeGreaterThan(0);

  const out: Claim[] = [];
  for (let t = 0; t < idx.length / 3; t++) {
    const a = idx[t * 3] * 3;
    const b = idx[t * 3 + 1] * 3;
    const c = idx[t * 3 + 2] * 3;
    const cx = (v[a] + v[b] + v[c]) / 3;
    const cy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3;
    const cz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
    const ux = v[b] - v[a];
    const uy = v[b + 1] - v[a + 1];
    const uz = v[b + 2] - v[a + 2];
    const vx = v[c] - v[a];
    const vy = v[c + 1] - v[a + 1];
    const vz = v[c + 2] - v[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const sample = {
      cx,
      cy,
      cz,
      nx: nx / len,
      ny: ny / len,
      nz: nz / len,
    };
    out.push({
      color: resolveCompartmentTriColor(plan, sample),
      cx,
      cy,
      cz,
      absNz: Math.abs(nz / len),
    });
  }
  return out;
}

describe('per-compartment shadow-box colours', () => {
  it('claims each compartment floor on its own side of the bin', () => {
    const params = twoUp();
    const floors = claims(params).filter((c) => c.color !== null && c.absNz > 0.8);

    expect(floors.length).toBeGreaterThan(0);
    // The left compartment sits at negative X, the right at positive X. A floor
    // triangle painted the wrong colour would show up as a sign mismatch.
    for (const f of floors) {
      expect(f.color).toBe(f.cx < 0 ? LEFT : RIGHT);
    }
    expect(floors.some((f) => f.color === LEFT)).toBe(true);
    expect(floors.some((f) => f.color === RIGHT)).toBe(true);
  });

  it('never claims anything below the cavity floor or above the rim', () => {
    const params = twoUp();
    const { floorZ, wallHeight } = binDimensions(params);
    const claimed = claims(params).filter((c) => c.color !== null);

    expect(claimed.length).toBeGreaterThan(0);
    for (const c of claimed) {
      expect(c.cz).toBeGreaterThanOrEqual(floorZ - 0.02);
      expect(c.cz).toBeLessThanOrEqual(floorZ + wallHeight + 0.02);
    }
  });

  it('leaves walls unpainted under the default floor-only scope', () => {
    const walls = claims(twoUp()).filter((c) => c.color !== null && c.absNz < 0.35);
    expect(walls).toHaveLength(0);
  });

  it('paints walls once the scope says so', () => {
    const params = twoUp({ compartmentColorScopes: ['floorAndWalls', 'floorAndWalls'] });
    const painted = claims(params).filter((c) => c.color !== null);

    expect(painted.some((c) => c.absNz < 0.35)).toBe(true);
    expect(painted.some((c) => c.absNz > 0.8)).toBe(true);
  });

  it('paints the shared divider from both sides, each in its own colour', () => {
    const params = twoUp({ compartmentColorScopes: ['floorAndWalls', 'floorAndWalls'] });
    // The divider straddles x = 0; its two faces sit thickness/2 either side.
    const dividerFaces = claims(params).filter(
      (c) => c.color !== null && c.absNz < 0.35 && Math.abs(c.cx) < 1.2
    );

    expect(dividerFaces.some((c) => c.color === LEFT)).toBe(true);
    expect(dividerFaces.some((c) => c.color === RIGHT)).toBe(true);
    // Each face is claimed by the compartment it FACES, so the left-hand face
    // (negative x, normal pointing -X) is the left compartment's.
    for (const f of dividerFaces) {
      expect(f.color).toBe(f.cx < 0 ? LEFT : RIGHT);
    }
  });

  it('leaves an uncoloured compartment alone', () => {
    const params = twoUp({ compartmentColors: [LEFT, null] });
    const claimed = claims(params).filter((c) => c.color !== null);

    expect(claimed.length).toBeGreaterThan(0);
    expect(claimed.every((c) => c.color === LEFT)).toBe(true);
    expect(claimed.every((c) => c.cx < 0)).toBe(true);
  });

  it('has no plan at all when nothing is coloured', () => {
    const params = twoUp({ compartmentColors: undefined });
    expect(planCompartmentColors(params)).toBeNull();
  });
});
