import type { TFunction } from '@/i18n';
import type { ToolSetSpec } from '@/features/bin-designer/types';
import { sizeEntries, TOOL_FAMILIES } from '@/shared/toolSets/catalog';

/**
 * The name a set shows when the user has not typed one. Derived each time,
 * never stored, so it follows the sizes and the app's language.
 */
export function toolSetName(spec: ToolSetSpec, t: TFunction): string {
  const sizes = sizeEntries(TOOL_FAMILIES[spec.family], spec.units, spec.sizes);
  const from = sizes.at(0)?.key ?? '';
  const to = sizes.at(-1)?.key ?? '';
  return spec.units === 'metric'
    ? t('binDesigner.toolSets.groupNameMetric', { from, to })
    : t('binDesigner.toolSets.groupNameSae', { from, to });
}

/** Group display names: a typed name, else a tool set's derived one. */
export function groupDisplayNames(
  typed: Readonly<Record<string, string>> | undefined,
  sets: Readonly<Record<string, ToolSetSpec>> | undefined,
  t: TFunction
): Record<string, string> {
  const derived = Object.fromEntries(
    Object.entries(sets ?? {}).map(([id, spec]) => [id, toolSetName(spec, t)])
  );
  return { ...derived, ...typed };
}
