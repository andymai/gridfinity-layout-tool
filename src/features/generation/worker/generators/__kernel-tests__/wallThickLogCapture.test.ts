// @vitest-environment node
/**
 * Diagnostic (not a CI gate): capture the kernel's warn-level log for the goma
 * export and count GFA rejections / mesh fallbacks.
 *
 * Tests the recorded claim that goma now runs with ZERO GFA rejections. The
 * exported solid measures 19385 faces ALL PLANAR (zero cylinders/cones) on a
 * bin whose base carries 12 cones + 24 cylinders, which is the canonical mesh
 * fallback tell — so either the claim no longer holds or it meant something
 * narrower than the whole export chain.
 *
 * `setLogLevel` is the only handle on kernel internals from JS (the cjs keeps
 * `wasm.memory` module-local). At warn the whole export emits ~1069 lines, so
 * keep all of them. Output goes to a FILE — the forks pool swallows console.
 */
import { describe, it, beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, setLastSolid } from '../shapeCache';

const OUT = process.env.LOG_OUT ?? '/tmp/goma-kernel.log';
const WALL = Number(process.env.WALL ?? '4');

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('wall-thickness kernel log capture', () => {
  it('counts GFA rejections and mesh fallbacks', async () => {
    const lines: string[] = [];
    const orig = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    const cap =
      (tag: string) =>
      (...args: unknown[]): void => {
        lines.push(`[${tag}] ${args.map((a) => String(a)).join(' ')}`);
      };

    const bkw = (await import('brepkit-wasm')) as unknown as {
      setLogLevel?: (l: string) => void;
    };
    bkw.setLogLevel?.('warn');

    clearAllCaches();
    setLastSolid(null);
    console.log = cap('log');
    console.warn = cap('warn');
    console.error = cap('error');
    const started = Date.now();
    let err = '';
    try {
      const { exportBin } = await import('../binExporter');
      await exportBin(
        buildParams({
          width: 1,
          depth: 1,
          height: 10,
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
          wallThickness: WALL,
        }),
        'stl'
      );
    } catch (e) {
      err = String(e);
    } finally {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
    }
    const ms = Date.now() - started;

    const count = (re: RegExp): number => lines.filter((l) => re.test(l)).length;
    const summary = [
      `ms=${ms}`,
      `error=${err}`,
      `totalLines=${lines.length}`,
      `gfaRejectNotAccepted=${count(/GFA result not accepted/i)}`,
      `gfaRejectDetail=${count(/GFA reject detail/i)}`,
      `gfaUnusableMeshFallback=${count(/GFA unusable|mesh \(co-refinement\) fallback/i)}`,
      `openGrowthShell=${count(/open growth shell/i)}`,
      `fallbackNotClosed=${count(/mesh fallback output is NOT a closed 2-manifold/i)}`,
      `eulerInvalid=${count(/Euler characteristic .* is invalid/i)}`,
      `gfaSucceeded=${count(/GFA .*succeeded/i)}`,
      `noOuterShell=${count(/no outer shell found/i)}`,
    ].join('\n');

    writeFileSync(
      OUT,
      `${summary}\n\n===== FIRST 400 LINES =====\n${lines.slice(0, 400).join('\n')}\n\n===== LAST 200 =====\n${lines.slice(-200).join('\n')}\n`
    );
  }, 1_800_000);
});
