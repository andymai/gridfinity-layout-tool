/**
 * Profiling wrapper for bin generation — measures time spent in each brepjs operation.
 *
 * Usage:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run src/features/generation/worker/generators/__dual-kernel__/profileBin.test.ts
 */
import * as brepjs from 'brepjs';

interface OpTiming {
  readonly op: string;
  readonly ms: number;
}

const timings: OpTiming[] = [];

function wrapFn<T extends (...args: never[]) => unknown>(name: string, fn: T): T {
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    const result = fn(...args);
    timings.push({ op: name, ms: performance.now() - start });
    return result;
  }) as T;
}

/**
 * Install timing hooks on brepjs module. Call before generating.
 *
 * NOTE: ESM namespace objects (`import * as mod`) are immutable per spec.
 * This works under Vitest because it rewrites ESM imports into mutable
 * CommonJS-style objects. It will NOT work in a native ESM runtime.
 */
export function installProfiling(): void {
  timings.length = 0;

  const ops = [
    'fuse',
    'fuseAll',
    'cut',
    'cutAll',
    'clone',
    'translate',
    'intersect',
    'mesh',
    'meshEdges',
    'box',
    'cylinder',
    'drawRoundedRectangle',
    'drawPolysides',
    'composeTransforms',
    'transformCopy',
    'exportSTL',
    'exportSTEP',
  ] as const;

  for (const name of ops) {
    if (typeof (brepjs as Record<string, unknown>)[name] === 'function') {
      const mod = brepjs as Record<string, (...args: never[]) => unknown>;
      mod[name] = wrapFn(name, mod[name]);
    }
  }

  // Wrap loftWith on Sketch prototype if accessible
  // (It's called as s1.loftWith([...]) — harder to wrap, skip for now)
}

/** Print aggregated timing report to console. */
export function printProfile(): void {
  // Aggregate by operation
  const agg = new Map<string, { count: number; totalMs: number }>();
  for (const { op, ms } of timings) {
    const entry = agg.get(op) ?? { count: 0, totalMs: 0 };
    entry.count++;
    entry.totalMs += ms;
    agg.set(op, entry);
  }

  // Sort by total time descending
  const sorted = [...agg.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);

  const totalMs = timings.reduce((sum, t) => sum + t.ms, 0);

  // eslint-disable-next-line no-console
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  // eslint-disable-next-line no-console
  console.log('║          brepjs Operation Profile                       ║');
  // eslint-disable-next-line no-console
  console.log('╠══════════════════════════════════════════════════════════╣');
  // eslint-disable-next-line no-console
  console.log(
    `║ ${'Operation'.padEnd(22)} ${'Count'.padStart(6)} ${'Total ms'.padStart(10)} ${'%'.padStart(6)} ║`
  );
  // eslint-disable-next-line no-console
  console.log('╟──────────────────────────────────────────────────────────╢');
  for (const [op, { count, totalMs: opTotal }] of sorted) {
    const pct = ((opTotal / totalMs) * 100).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(
      `║ ${op.padEnd(22)} ${String(count).padStart(6)} ${opTotal.toFixed(1).padStart(10)} ${pct.padStart(5)}% ║`
    );
  }
  // eslint-disable-next-line no-console
  console.log('╠══════════════════════════════════════════════════════════╣');
  // eslint-disable-next-line no-console
  console.log(`║ Total tracked: ${totalMs.toFixed(1).padStart(10)} ms                         ║`);
  // eslint-disable-next-line no-console
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

/** Get raw timings array (for programmatic access). */
export function getTimings(): readonly OpTiming[] {
  return timings;
}
