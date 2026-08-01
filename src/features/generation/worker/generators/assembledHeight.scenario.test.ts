/**
 * Parity between the designer's analytic assembled-height readout and the
 * geometry the kernel actually builds (issue #3037).
 *
 * `assembledHeight()` derives the stack from constants so the sidebar and the
 * dimension lines can update before a mesh exists. That only stays honest if
 * the derivation tracks the real meshes, so this runs the actual brepjs build
 * and measures them:
 *
 *   - the bin mesh's top face must equal the analytic bin + stacking-lip bands,
 *   - the lid mesh's top face must sit at lid-local Z=0 (or SOCKET_HEIGHT with
 *     a stack grid), which is what the lid/grid bands assume,
 *   - assembling both the way `LidMesh` positions them must reproduce `totalMm`.
 *
 *   pnpm run test:run -- src/features/generation/worker/generators/assembledHeight.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { assembledHeight } from '@/features/bin-designer/utils/assembledHeight';
import {
  LID_FIT_CLEARANCE,
  lidAnchorZ,
  resolveLidCavityExtraMm,
} from '@/features/bin-designer/types/lid';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

function makeParams(extra: Partial<BinParams> = {}, lid: Partial<LidConfig> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    ...extra,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, ...extra.base },
    lid: { ...DEFAULT_BIN_PARAMS.lid, ...lid },
  };
}

/** Sum of the named bands, mirroring how the UI groups them. */
function bandSum(params: BinParams, kinds: readonly string[]): number {
  return assembledHeight(params)
    .segments.filter((s) => kinds.includes(s.kind))
    .reduce((acc, s) => acc + s.mm, 0);
}

/**
 * World Z where `LidMesh` puts the lid's local origin: the lip top lifted by
 * `-anchorZ`. Mirrors the preview's `lidGroupZ` without its 0.1mm render nudge.
 */
function lidGroupZ(params: BinParams, lipTopZ: number): number {
  return (
    lipTopZ - lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params))
  );
}

describe('assembled height matches generated geometry', () => {
  describe('bin mesh top face', () => {
    it('equals the bin + stacking-lip bands', () => {
      const params = makeParams();
      const mesh = getGenerateBin()(params);
      expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(
        bandSum(params, ['bin', 'stackingLip']),
        1
      );
    });

    it('equals the bin band alone when the lip is off', () => {
      const params = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
      const mesh = getGenerateBin()(params);
      expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(bandSum(params, ['bin']), 1);
    });

    it('tracks the extra wall-height collar', () => {
      const params = makeParams({ extraWallHeightMm: 9 });
      const mesh = getGenerateBin()(params);
      expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(
        bandSum(params, ['bin', 'stackingLip']),
        1
      );
    });

    it('sits at zero for a flat base, which has no socket to nest', () => {
      const params = makeParams({
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
      });
      const mesh = getGenerateBin()(params);
      expect(boundingBox(mesh.vertices).minZ).toBeCloseTo(0, 1);
      expect(assembledHeight(params).nestedMm).toBe(0);
    });
  });

  describe('lid mesh top face', () => {
    it('sits at lid-local Z=0 without a stack grid', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const lid = generateLid(makeParams({}, { enabled: true, stackableTop: false }));
      expect(lid).not.toBeNull();
      expect(boundingBox(lid!.vertices).maxZ).toBeCloseTo(0, 1);
    });

    it('rises by SOCKET_HEIGHT with a stack grid', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const lid = generateLid(makeParams({}, { enabled: true, stackableTop: true }));
      expect(lid).not.toBeNull();
      expect(boundingBox(lid!.vertices).maxZ).toBeCloseTo(GRIDFINITY_SPEC.SOCKET_HEIGHT, 1);
    });
  });

  describe('seated assembly', () => {
    const cases: [string, Partial<LidConfig>, Partial<BinParams>][] = [
      ['plain lid', { enabled: true }, {}],
      ['stackable lid', { enabled: true, stackableTop: true }, {}],
      ['tall lid', { enabled: true, extraHeightMm: 14 }, {}],
      ['thick-plate lid', { enabled: true, topThicknessMm: 3 }, {}],
      ['collared bin', { enabled: true }, { extraWallHeightMm: 9 }],
    ];

    it.each(cases)('reproduces totalMm for a %s', async (_label, lid, extra) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = makeParams(extra, lid);

      const binTop = boundingBox(getGenerateBin()(params).vertices).maxZ;
      const lidMesh = generateLid(params);
      expect(lidMesh).not.toBeNull();
      const measuredTop = lidGroupZ(params, binTop) + boundingBox(lidMesh!.vertices).maxZ;

      expect(measuredTop).toBeCloseTo(assembledHeight(params).totalMm, 1);
    });
  });
});
