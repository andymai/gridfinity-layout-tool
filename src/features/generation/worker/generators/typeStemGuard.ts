/**
 * Which designs will print type too fine to resolve.
 *
 * A glyph's narrowest stem shrinks with the rendered size, and below roughly
 * two extrusion widths the slicer stops putting a wall between two edges: the
 * letterforms print as a blob. Nothing about that is visible in the mesh, which
 * is watertight and correctly shaped, so the answer has to be reported
 * alongside it the way {@link planLabelTextOverflow} reports blank captions.
 *
 * The narrowest stem is monotonic in size for a given face, so the binding case
 * is always the SMALLEST size the design renders. Walls and label tabs are
 * where that happens in practice: a wall caption shrinks to clear a handle, and
 * a tab is small to begin with. The lid is deliberately not walked, because its
 * host face is the largest in the design and its size can only be the binding
 * one if a wall or tab already tripped the warning.
 *
 * Runs outside the cached feature pipeline, so it cannot change a triangle of
 * the geometry it reports on.
 */

import type { BinParams } from '@/shared/types/bin';
import { resolveTextStyle } from '@/shared/types/bin';
import { MIN_PRINTABLE_STEM_MM, planMinStemMm } from '@/shared/utils/typePlan';
import type { TypeBlockPlan } from '@/shared/utils/typePlan';
import type { TypeStemWarning } from '../../bridge/types';
import { computeWallTextLayouts } from './wallTextLayout';
import { resolveUniformTabTextSize } from './labelTabBuilder';
import { planLabelTabLayout } from '@/shared/utils/labelTabPlan';
import { getTypeMeasurer, planTextForHost } from './textBuilder';
import { deriveDimensions } from './pipeline/context';

export function planTypeStemWarning(params: BinParams): TypeStemWarning | undefined {
  const dim = deriveDimensions(params, false);
  const plans: TypeBlockPlan[] = [];

  for (const layout of computeWallTextLayouts(params, dim)) plans.push(layout.plan);

  if (params.label.enabled && (params.label.mode ?? 'text') !== 'socket') {
    const style = resolveTextStyle(params.textDefaults, params.label.textStyle);
    const layout = planLabelTabLayout(
      params,
      dim.innerW,
      dim.innerD,
      dim.interiorHeight,
      params.wallThickness
    );
    for (const row of layout?.plannedRows ?? []) {
      const shared = resolveUniformTabTextSize(params, row.slots, layout?.dims.tabDepth ?? 0);
      for (const slot of row.slots) {
        if (!slot.text.trim()) continue;
        const plan = planTextForHost({
          text: slot.text,
          style,
          availW: slot.tabWidth,
          availD: layout?.dims.tabDepth ?? 0,
          hostKind: 'plaque',
          ...(shared !== undefined ? { sharedSizeMm: shared } : {}),
        });
        if (plan) plans.push(plan);
      }
    }
  }

  if (plans.length === 0) return undefined;

  const measurer = getTypeMeasurer();
  let worst: { stem: number; plan: TypeBlockPlan } | null = null;
  for (const plan of plans) {
    const stem = planMinStemMm(plan, measurer);
    if (stem === null) continue;
    if (!worst || stem < worst.stem) worst = { stem, plan };
  }
  if (!worst || worst.stem >= MIN_PRINTABLE_STEM_MM) return undefined;

  return {
    minStemMm: worst.stem,
    fontSizeMm: worst.plan.fontSize,
    minPrintableStemMm: MIN_PRINTABLE_STEM_MM,
  };
}
