// @vitest-environment node
/**
 * A slanted bin is its upright twin sheared above the floor. A shear keeps
 * volume and every z, moves the top by tan(angle) per mm of rise, and must
 * leave the socket exactly where it was, or the bin no longer seats. Face
 * origins have to survive too: the transform rebuilds every face, and a lost
 * origin collapses a coloured 3MF to one colour without failing anything else.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox, meshTopologyStats, meshVolume } from './__kernel-tests__/meshAssertions';
import { makeCutout } from './__kernel-tests__/scenarioTypes';
import { deriveDimensions } from './pipeline/context';
import { generateSplitPreview } from './splitBinBuilder';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { shouldGenerateLid } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';
import type { SlantSide } from '@/core/types';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

const UPRIGHT: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 1,
  depth: 2,
  height: 6,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
};

function generate(params: BinParams, forExport = true): MeshData {
  return getGenerateBin()(params, undefined, forExport);
}

function slanted(params: BinParams, angleDeg: number, side: SlantSide): BinParams {
  return { ...params, slant: { angleDeg, side } };
}

/** The extent of vertices at or below `z` along one axis. */
function extentBelow(vertices: Float32Array, z: number, axis: 0 | 1): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 2] > z) continue;
    lo = Math.min(lo, vertices[i + axis]);
    hi = Math.max(hi, vertices[i + axis]);
  }
  return [lo, hi];
}

function tags(mesh: MeshData): number[] {
  return [...new Set((mesh.faceGroups ?? []).map((g) => g.tag))].sort((a, b) => a - b);
}

/**
 * The height band each feature colour covers. A shear never moves z, so every
 * tag's band must match the upright twin's: origins paired with the wrong faces
 * would keep the same set of tags but move a colour onto another feature.
 */
function tagBands(mesh: MeshData): Map<number, [number, number]> {
  const bands = new Map<number, [number, number]>();
  for (const group of mesh.faceGroups ?? []) {
    const band = bands.get(group.tag) ?? [Infinity, -Infinity];
    for (let i = group.start; i < group.start + group.count; i++) {
      const z = mesh.vertices[mesh.indices[i] * 3 + 2];
      band[0] = Math.min(band[0], z);
      band[1] = Math.max(band[1], z);
    }
    bands.set(group.tag, band);
  }
  return bands;
}

function expectSlantOf(
  upright: MeshData,
  slant: MeshData,
  params: BinParams,
  angleDeg: number,
  side: SlantSide
): void {
  const before = boundingBox(upright.vertices);
  const after = boundingBox(slant.vertices);
  const topo = meshTopologyStats(slant);
  expect(topo.boundaryEdges).toBe(0);
  expect(topo.nonManifoldEdges).toBe(0);
  expect(meshVolume(slant) / meshVolume(upright)).toBeCloseTo(1, 3);
  expect(after.minZ).toBeCloseTo(before.minZ, 3);
  expect(after.maxZ).toBeCloseTo(before.maxZ, 3);

  const pivot = deriveDimensions(params, true).baseOffsetZ;
  const shift = Math.tan((angleDeg * Math.PI) / 180) * (before.maxZ - pivot);
  const axis = side === 'left' || side === 'right' ? 0 : 1;
  const [beforeMin, beforeMax] =
    axis === 0 ? [before.minX, before.maxX] : [before.minY, before.maxY];
  const [afterMin, afterMax] = axis === 0 ? [after.minX, after.maxX] : [after.minY, after.maxY];
  if (side === 'right' || side === 'back') {
    expect(afterMax - beforeMax).toBeCloseTo(shift, 1);
    expect(afterMin).toBeCloseTo(beforeMin, 2);
  } else {
    expect(beforeMin - afterMin).toBeCloseTo(shift, 1);
    expect(afterMax).toBeCloseTo(beforeMax, 2);
  }

  // The socket seats in a baseplate only if it has not moved at all.
  for (const a of [0, 1] as const) {
    const [lo, hi] = extentBelow(upright.vertices, pivot - 0.01, a);
    const [slo, shi] = extentBelow(slant.vertices, pivot - 0.01, a);
    expect(slo).toBeCloseTo(lo, 3);
    expect(shi).toBeCloseTo(hi, 3);
  }
}

describe('slanted bin geometry', () => {
  const upright = (): MeshData => generate(UPRIGHT);

  it.each(['front', 'back', 'left', 'right'] as const)(
    'leans toward %s at 45 degrees with the socket left upright',
    (side) => {
      const params = slanted(UPRIGHT, 45, side);
      expectSlantOf(upright(), generate(params), params, 45, side);
    },
    120_000
  );

  it.each([15, 30, 60])(
    'shifts the top by tan(angle) per mm of rise at %i degrees',
    (angle) => {
      const params = slanted(UPRIGHT, angle, 'back');
      expectSlantOf(upright(), generate(params), params, angle, 'back');
    },
    120_000
  );

  it('clamps an angle past the ceiling to 60 degrees', () => {
    const params = slanted(UPRIGHT, 80, 'back');
    expectSlantOf(upright(), generate(params), params, 60, 'back');
  }, 120_000);

  const featured: [string, Partial<BinParams>][] = [
    [
      'dividers',
      { compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 1, rows: 3, cells: [0, 1, 2] } },
    ],
    ['a label tab', { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } }],
    ['a scoop', { scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true } }],
    [
      'a floor cutout',
      { cutouts: [makeCutout({ x: 5, y: 20, width: 20, depth: 30, cutDepth: 4 })] },
    ],
    ['a wall pattern', { wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true } }],
    ['a half-unit width', { width: 1.5 }],
    ['a magnet base', { base: { ...UPRIGHT.base, style: 'magnet' } }],
    ['a weighted base', { base: { ...UPRIGHT.base, style: 'weighted' } }],
  ];

  it.each(featured)(
    'keeps %s watertight, the same volume, and every feature colour',
    (_label, overrides) => {
      const base = { ...UPRIGHT, ...overrides };
      const params = slanted(base, 40, 'back');
      const before = generate(base);
      const after = generate(params);
      expectSlantOf(before, after, params, 40, 'back');
      expect(tags(after)).toEqual(tags(before));
      expect(tags(after).length).toBeGreaterThan(1);
      const uprightBands = tagBands(before);
      for (const [tag, [lo, hi]] of tagBands(after)) {
        const [ulo, uhi] = uprightBands.get(tag) ?? [Number.NaN, Number.NaN];
        expect(lo, `tag ${tag} bottom`).toBeCloseTo(ulo, 2);
        expect(hi, `tag ${tag} top`).toBeCloseTo(uhi, 2);
      }
    },
    180_000
  );

  it('slants the preview mesh the same way', () => {
    const params = slanted(UPRIGHT, 45, 'right');
    const preview = generate(params, false);
    const exported = generate(params, true);
    const p = boundingBox(preview.vertices);
    const e = boundingBox(exported.vertices);
    expect(p.maxX).toBeCloseTo(e.maxX, 1);
    expect(p.minX).toBeCloseTo(e.minX, 1);
    expect(p.maxZ).toBeCloseTo(e.maxZ, 1);
  }, 120_000);
});

describe('slant blockers', () => {
  it('ignores the slant while an overhang reshapes the wall', () => {
    const withOverhang: BinParams = {
      ...UPRIGHT,
      overhang: { enabled: true, left: 5, right: 0, front: 0, back: 0 },
    };
    const plain = boundingBox(generate(withOverhang).vertices);
    const tried = boundingBox(generate(slanted(withOverhang, 45, 'back')).vertices);
    expect(tried.maxY).toBeCloseTo(plain.maxY, 3);
  }, 120_000);

  it('drops the stacking lip and the lid', () => {
    const lidded: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 4,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    };
    expect(shouldGenerateLid(lidded)).toBe(true);
    const params = slanted(lidded, 30, 'back');
    expect(shouldGenerateLid(params)).toBe(false);
    const withLip = boundingBox(generate(lidded).vertices);
    const lipless = boundingBox(generate(params).vertices);
    expect(lipless.maxZ).toBeLessThan(withLip.maxZ);
  }, 120_000);

  it('refuses to split', () => {
    expect(() => generateSplitPreview(slanted(UPRIGHT, 30, 'back'), [], [21])).toThrow(
      'A slanted bin cannot be split'
    );
  });
});
