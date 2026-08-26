// @vitest-environment node
/**
 * Diagnostic (not a CI gate): per-stage timing breakdown for kumiko bins.
 * Chases the "very slow preview" report — identifies whether time goes to
 * cutter construction, the pattern-cut boolean, meshing, or edge meshing.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/kumikoProfile --reporter=verbose
 */
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { WallPatternType } from '@/shared/types/bin';
import { clearAllCaches } from '../shapeCache';
import { PerfCollector } from '../pipeline/perfCollector';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

const PATTERN = (process.env.KUMIKO_PROFILE_PATTERN ?? 'mitsukude') as WallPatternType;

function profile(label: string, width: number, depth: number, height: number): void {
  clearAllCaches();
  const perf = new PerfCollector();
  const start = performance.now();
  getGenerateBin()(
    buildParams({
      width,
      depth,
      height,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: PATTERN },
    }),
    undefined,
    false,
    undefined,
    perf
  );
  const total = performance.now() - start;
  const snap = perf.snapshot(total);
  console.log(`\n=== ${label}: total ${total.toFixed(0)}ms ===`);
  for (const s of snap.stages) console.log(`  stage ${s.name}: ${s.ms.toFixed(0)}ms`);
  for (const s of snap.wallPatternSubsteps)
    console.log(`  wallPattern ${s.name}: ${s.ms.toFixed(0)}ms${s.count ? ` (n=${s.count})` : ''}`);
}

describe('kumiko generation profile', () => {
  it('profiles mitsukude bins', () => {
    if (process.env.KUMIKO_PROFILE_CASE === '4x4x6') {
      profile('4x4x6', 4, 4, 6);
      return;
    }
    if (process.env.KUMIKO_PROFILE_CASE === '1x1x6') {
      profile('1x1x6', 1, 1, 6);
      return;
    }
    profile('1x1x6', 1, 1, 6);
    profile('2x2x3', 2, 2, 3);
    profile('4x4x6', 4, 4, 6);
  }, 900_000);
});
