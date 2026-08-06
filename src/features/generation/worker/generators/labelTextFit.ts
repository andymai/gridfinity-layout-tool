/**
 * Which label captions a design will silently fail to render.
 *
 * Both text hosts drop an overlong run rather than shrinking it: a tab because
 * `resolveUniformTabTextSize` excludes it from the group fit, a plate because
 * one long caption would otherwise shrink the whole set. Either way the part
 * prints blank and the mesh holds no evidence, so the answer has to be reported
 * alongside it.
 *
 * Runs outside the cached feature pipeline (like `generateLabelPlates`), so it
 * cannot change a single triangle of the geometry it reports on.
 */

import type { BinParams } from '@/shared/types/bin';
import type { LabelTextOverflow } from '../../bridge/types';
import { planLabelPlateSeats, planTabTextOverflow } from './labelTabBuilder';
import { plateTextFits } from './labelPlateBuilder';
import { deriveDimensions } from './pipeline/context';

export function planLabelTextOverflow(params: BinParams): LabelTextOverflow[] {
  if (!params.label.enabled) return [];

  const dim = deriveDimensions(params, false);

  if ((params.label.mode ?? 'text') !== 'socket') {
    return planTabTextOverflow(
      params,
      dim.innerW,
      dim.innerD,
      dim.interiorHeight,
      params.wallThickness
    );
  }

  const opts = {
    textMode: params.textDefaults.mode === 'emboss' ? ('emboss' as const) : ('deboss' as const),
    textDepthMm: params.textDefaults.depth,
    textDefaults: params.textDefaults,
    v1Channels: true,
  };

  // Every planned seat, not just the previewed ones: a caption past the preview
  // ceiling still prints blank on the exported sheet.
  const seats = planLabelPlateSeats(
    params,
    dim.innerW,
    dim.innerD,
    dim.interiorHeight,
    params.wallThickness
  );

  // One entry per CAPTION, not per seat: `edges: 'both'` seats the same
  // compartment's plate at each anchor, and both carry the same text, so the
  // raw seat list would report that caption twice. The tab path dedupes for the
  // same reason — keep the payload canonical rather than leaving it to whatever
  // the consumer happens to do with it.
  const seen = new Set<string>();
  const overflows: LabelTextOverflow[] = [];
  for (const seat of seats) {
    const key = `${seat.scope}:${seat.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const spec = {
      widthU: seat.plateWidthU,
      text: seat.text,
      ...(seat.icon ? { icon: seat.icon } : {}),
    };
    if (plateTextFits(spec, opts)) continue;
    overflows.push({ scope: seat.scope, index: seat.index });
  }
  return overflows;
}
