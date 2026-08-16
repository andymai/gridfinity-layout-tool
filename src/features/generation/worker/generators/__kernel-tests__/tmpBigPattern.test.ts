// @vitest-environment node
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { computeGenerationTimeoutMs } from '@/features/generation/bridge/generationTimeout';
import { appendFileSync } from 'node:fs';

const LOG = '/tmp/bigpattern2.log';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const CASE = Number(process.env.BIG_H ?? 20);
const W = Number(process.env.BIG_W ?? 6);

describe('large patterned bin', () => {
  it(`${W}x${W}x${CASE} honeycomb`, () => {
    const params = buildParams({
      width: W,
      depth: W,
      height: CASE,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    });
    const budget = computeGenerationTimeoutMs(params);
    const start = performance.now();
    try {
      const result = getGenerateBin()(params, undefined, false);
      const ms = performance.now() - start;
      appendFileSync(
        LOG,
        `RESULT ${W}x${W}x${CASE}: ${(ms / 1000).toFixed(1)}s vs budget ${(budget / 1000).toFixed(0)}s => ${
          ms > budget ? 'TIMES OUT' : 'fits'
        } (${result.triangleCount} tris)\n`
      );
    } catch (e) {
      const ms = performance.now() - start;
      appendFileSync(
        LOG,
        `RESULT ${W}x${W}x${CASE}: THREW after ${(ms / 1000).toFixed(1)}s (budget ${(budget / 1000).toFixed(0)}s): ${String(e)}\n`
      );
    }
  });
});
