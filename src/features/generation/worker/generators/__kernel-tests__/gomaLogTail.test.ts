// @vitest-environment node
/** Diagnostic: capture brepkit's kernel log for a goma export. UNTRACKED — gets git-cleaned; recreate before running. */
import { describe, it, beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, setLastSolid } from '../shapeCache';
const OUT = process.env.PROBE_OUT ?? '/tmp/goma_log.txt';
const KEEP = Number(process.env.KEEP ?? 5000);
const LEVEL = process.env.LOG_LEVEL ?? 'warn';
const HEIGHT = Number(process.env.HEIGHT ?? 6);
describe('goma log capture', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);
  it('captures the kernel log for a goma export', async () => {
    const mod = await import('brepkit-wasm');

    const setLogLevel = (mod as any).setLogLevel;
    if (typeof setLogLevel === 'function') setLogLevel(LEVEL);
    const ring: string[] = [];
    let total = 0;
    const push = (s: string): void => {
      total++;
      ring.push(s);
      if (ring.length > KEEP) ring.shift();
    };
    const orig = { log: console.log, warn: console.warn, error: console.error };

    const cap =
      (tag: string) =>
      (...args: any[]): void => {
        push(`[${tag}] ${args.map((a) => String(a)).join(' ')}`);
      };
    console.log = cap('log');
    console.warn = cap('warn');
    console.error = cap('error');
    const lines: string[] = [];
    clearAllCaches();
    setLastSolid(null);
    const { exportBin } = await import('../binExporter');
    const t0 = performance.now();
    try {
      const r = await exportBin(
        buildParams({
          width: 1,
          depth: 1,
          height: HEIGHT,
          wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'goma' },
        }),
        'stl'
      );
      lines.push(`h=${HEIGHT} OK ${Math.round(performance.now() - t0)}ms ${r.data.byteLength}B`);
    } catch (e) {
      lines.push(
        `h=${HEIGHT} THREW ${Math.round(performance.now() - t0)}ms :: ${(e as Error).message}`
      );
    } finally {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
    }
    lines.push(`kernel log lines: ${total}${total > ring.length ? ' (TRUNCATED)' : ' (complete)'}`);
    lines.push('──── LOG ────');
    lines.push(...ring);
    writeFileSync(OUT, `${lines.join('\n')}\n`);
    orig.log(lines.slice(0, 3).join('\n'));
  }, 3_000_000);
});
