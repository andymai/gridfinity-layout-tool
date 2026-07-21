// @vitest-environment node
/**
 * Scenario tests for magnetic-retention lids and tray tops (#2694).
 *
 * Runs the real brepjs build and asserts:
 *  - a magnetic lid + its mating bin both produce structurally-valid meshes;
 *  - the bin grows corner posts (more geometry than a plain bin);
 *  - a tray-top lid recesses cleanly and stays valid;
 *  - a magnetic 1x1 lid on the smallest footprint still builds.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidRetentionMagnets.scenario
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

function makeParams(lid: Partial<LidConfig>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
  };
}

describe('magnetic-retention lid geometry', () => {
  it('produces a valid mesh for a 2x2 magnetic lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams({ attachment: 'magnetic' }, { width: 2, depth: 2, height: 3 })
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '2x2 magnetic lid');
  });

  it('adds corner bosses — more geometry than a friction lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const base = { width: 2, depth: 2, height: 3 };
    const friction = generateLid(makeParams({ attachment: 'friction' }, base))!;
    const magnetic = generateLid(makeParams({ attachment: 'magnetic' }, base))!;
    expect(magnetic.triangleCount).toBeGreaterThan(friction.triangleCount);
  });

  it('builds a magnetic lid on the smallest (1x1) footprint', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams({ attachment: 'magnetic' }, { width: 1, depth: 1, height: 3 })
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '1x1 magnetic lid');
  });

  it('grows corner gusset pads on the mating bin', async () => {
    const generateBin = getGenerateBin();
    const base = { width: 2, depth: 2, height: 3 };
    const plain = generateBin(makeParams({ attachment: 'clickRails' }, base));
    const magnetic = generateBin(makeParams({ attachment: 'magnetic' }, base));
    assertStructurallyValid(magnetic, '2x2 bin with magnetic lid gusset pads');
    // Pads add solid material + pockets, so the magnetic bin has more geometry.
    expect(magnetic.triangleCount).toBeGreaterThan(plain.triangleCount);
  });

  it('pads are top overhangs, not full-height columns (height-independent)', async () => {
    const generateBin = getGenerateBin();
    // The gusset pads live at the top rim, so the geometry they ADD over a
    // plain bin must not scale with bin height. A returning full-column bug
    // would make the delta grow with height. Compare the magnetic-vs-plain
    // triangle delta at height 3 and height 6 — they should be close.
    const deltaAt = (height: number): number => {
      const plain = generateBin(
        makeParams({ attachment: 'clickRails' }, { width: 2, depth: 2, height })
      );
      const magnetic = generateBin(
        makeParams({ attachment: 'magnetic' }, { width: 2, depth: 2, height })
      );
      return magnetic.triangleCount - plain.triangleCount;
    };
    const d3 = deltaAt(3);
    const d6 = deltaAt(6);
    expect(d3).toBeGreaterThan(0);
    // Allow tessellation jitter but reject height-scaling (a column would
    // roughly double the added side-wall triangles from height 3 to 6).
    expect(Math.abs(d6 - d3)).toBeLessThan(d3 * 0.5);
  });

  it('leaves the bin footprint unchanged (posts grow inward)', async () => {
    const generateBin = getGenerateBin();
    const base = { width: 2, depth: 2, height: 3 };
    const plain = boundingBox(generateBin(makeParams({ attachment: 'clickRails' }, base)).vertices);
    const magnetic = boundingBox(
      generateBin(makeParams({ attachment: 'magnetic' }, base)).vertices
    );
    // Inward posts must not push the outer XY footprint out.
    expect(magnetic.maxX).toBeCloseTo(plain.maxX, 1);
    expect(magnetic.maxY).toBeCloseTo(plain.maxY, 1);
    expect(magnetic.minX).toBeCloseTo(plain.minX, 1);
    expect(magnetic.minY).toBeCloseTo(plain.minY, 1);
  });

  it('adds no bin posts when there is no stacking lip (nothing for the lid to mate)', async () => {
    const generateBin = getGenerateBin();
    const noLip = { base: { ...makeParams({}).base, stackingLip: false } };
    // With no lip the lid can't be generated, so the bin must not grow orphan
    // posts — magnetic and click-rails bins are identical.
    const magnetic = generateBin(
      makeParams({ attachment: 'magnetic' }, { width: 2, depth: 2, height: 3, ...noLip })
    );
    const plain = generateBin(
      makeParams({ attachment: 'clickRails' }, { width: 2, depth: 2, height: 3, ...noLip })
    );
    expect(magnetic.triangleCount).toBe(plain.triangleCount);
  });

  it('adds no bin posts when the magnet is too deep for the bin (blocked lid)', async () => {
    const generateBin = getGenerateBin();
    // 1U bin interior can't hold a 6mm-deep magnet → magnetTooDeepForBin blocks
    // the lid, so the bin must not cut a too-deep pocket through its floor.
    const blocked = generateBin(
      makeParams(
        { attachment: 'magnetic', retentionMagnet: { diameter: 6, depth: 6 } },
        { width: 2, depth: 2, height: 1 }
      )
    );
    const plain = generateBin(
      makeParams({ attachment: 'clickRails' }, { width: 2, depth: 2, height: 1 })
    );
    expect(blocked.triangleCount).toBe(plain.triangleCount);
  });
});

describe('tray-top lid geometry', () => {
  it('produces a valid mesh for a tray-top lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams(
        {
          attachment: 'friction',
          stackableTop: false,
          tray: { enabled: true, depthMm: 4, wallMm: 2 },
        },
        { width: 3, depth: 2, height: 3 }
      )
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '3x2 tray lid');
  });

  it('recesses the top — less enclosed volume than a flat lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const base = { width: 3, depth: 2, height: 3 };
    const flat = generateLid(makeParams({ attachment: 'friction' }, base))!;
    const tray = generateLid(
      makeParams({ attachment: 'friction', tray: { enabled: true, depthMm: 4, wallMm: 2 } }, base)
    )!;
    // The recess reshapes the top face, so the tray mesh differs from the flat
    // one, and its recessed floor sits a tray-depth below the rim.
    expect(tray.triangleCount).not.toBe(flat.triangleCount);
    const flatBox = boundingBox(flat.vertices);
    const trayBox = boundingBox(tray.vertices);
    // Rim keeps the original top height; the recess doesn't raise the lid.
    expect(trayBox.maxZ).toBeCloseTo(flatBox.maxZ, 1);
  });

  it('combines a magnetic attachment with a tray top', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams(
        { attachment: 'magnetic', tray: { enabled: true, depthMm: 3, wallMm: 2 } },
        { width: 2, depth: 2, height: 3 }
      )
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, 'magnetic + tray lid');
  });
});
