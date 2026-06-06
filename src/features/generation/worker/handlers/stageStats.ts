import type { PerfSnapshot } from '../../bridge/types';

/**
 * Convert pipeline stage timings into the kernel-perf stats shape, namespaced
 * with a `stage_` prefix so they never collide with brepjs's op categories.
 *
 * Stage names are not unique: translateStage and tessellateStage both report as
 * `'merge'` (they share the `'merge'` progress phase), so two entries collapse
 * into `stage_merge` with `count: 2`. The accumulation is required — overwriting
 * per key would silently drop the translate timing.
 */
export function stageStats(
  snapshot: PerfSnapshot
): Record<string, { totalMs: number; count: number }> {
  const acc = new Map<string, { totalMs: number; count: number }>();
  for (const { name, ms } of snapshot.stages) {
    const key = `stage_${name}`;
    const prev = acc.get(key);
    if (prev) {
      prev.totalMs += ms;
      prev.count += 1;
    } else {
      acc.set(key, { totalMs: ms, count: 1 });
    }
  }
  return Object.fromEntries(acc);
}
