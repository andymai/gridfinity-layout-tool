import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';

/** The innermost tool set every selected cutout sits in, or null. */
export function toolSetOf(
  selected: readonly Cutout[],
  sets: Readonly<Record<string, ToolSetSpec>> | undefined
): string | null {
  if (!sets || selected.length === 0) return null;
  // `parentGroups` runs outermost first; the innermost set is the one picked.
  const candidates = [...(selected[0].parentGroups ?? [])].reverse();
  return (
    candidates.find(
      (id) => id in sets && selected.every((c) => c.parentGroups?.includes(id) === true)
    ) ?? null
  );
}
