import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';

/** The tool set every selected cutout sits in, or null. */
export function toolSetOf(
  selected: readonly Cutout[],
  sets: Readonly<Record<string, ToolSetSpec>> | undefined
): string | null {
  if (!sets || selected.length === 0) return null;
  const candidates = selected[0].parentGroups ?? [];
  return (
    candidates.find(
      (id) => id in sets && selected.every((c) => c.parentGroups?.includes(id) === true)
    ) ?? null
  );
}
