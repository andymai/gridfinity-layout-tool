/**
 * A bin at the height cap really is that tall.
 *
 * `DESIGNER_CONSTRAINTS.MAX_HEIGHT` is enforced by validators that never see
 * geometry, so raising it proves only that the payload is accepted. This
 * asserts the other end: the generator builds the full `height * heightUnitMm`,
 * and its topology is unchanged by the extra height, so the cap is a policy
 * number rather than one the kernel is tuned around.
 *
 * Run via the profile config (excluded from CI's unit projects):
 *   pnpm exec vitest run --config vitest.profile.config.ts tallBin
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { boundingBox } from './meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

function generateAt(height: number): ReturnType<ReturnType<typeof getGenerateBin>> {
  return getGenerateBin()(
    buildParams({
      width: 2,
      depth: 2,
      height,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
    }),
    undefined,
    false
  );
}

describe('a bin at MAX_HEIGHT', () => {
  it('stands the full height the cap promises', () => {
    const result = generateAt(DESIGNER_CONSTRAINTS.MAX_HEIGHT);
    const bb = boundingBox(result.vertices);

    // The stacking lip tops out above the nominal body, so the span is at
    // least the nominal height rather than exactly it.
    const nominalMm = DESIGNER_CONSTRAINTS.MAX_HEIGHT * GRIDFINITY_SPEC.HEIGHT_UNIT;
    expect(bb.maxZ - bb.minZ).toBeGreaterThanOrEqual(nominalMm);
    expect(Number.isFinite(bb.maxZ)).toBe(true);
    expect(result.triangleCount).toBeGreaterThan(0);
  });

  it('adds no topology over a short bin: height is an extrude, not a feature', () => {
    const short = generateAt(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
    const tall = generateAt(DESIGNER_CONSTRAINTS.MAX_HEIGHT);

    expect(tall.triangleCount).toBe(short.triangleCount);
  });
});
