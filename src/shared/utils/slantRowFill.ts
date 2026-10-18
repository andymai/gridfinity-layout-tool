import type { Bin, Rect, SlantConfig } from '@/core/types';
import { gridUnits } from '@/core/types';
import { placedSlant, type SlantLayout } from './placedSlant';
import { slantPlanFor } from './slantPlan';

const EPS = 1e-9;

export interface SlantedRow {
  /** From the trailing end to the leading bin, which carries the end support. */
  readonly bins: readonly Rect[];
  readonly support: Rect;
}

/**
 * Rows of `size` bins leaning `slant`'s way that fit `area` with their end
 * supports. Rows run along the lean, side by side across it, start at the
 * area's trailing end, and each keeps the cells past its leading bin for its
 * support, sized as placement sizes it.
 */
export function planSlantedRows(
  area: Rect,
  size: { readonly width: number; readonly depth: number },
  height: number,
  slant: SlantConfig,
  layout: SlantLayout,
  maxPerRow = Infinity
): SlantedRow[] {
  const plan = slantPlanFor(slant);
  if (!plan) return [];
  const alongX = plan.axis === 'x';
  const binAlong = alongX ? size.width : size.depth;
  const binCross = alongX ? size.depth : size.width;
  const areaAlong = alongX ? area.width : area.depth;
  const areaCross = alongX ? area.depth : area.width;
  const along0 = alongX ? area.x : area.y;
  const cross0 = alongX ? area.y : area.x;
  const rowCount = Math.floor((areaCross + EPS) / binCross);

  const rect = (along: number, cross: number, alongLen: number, crossLen: number): Rect =>
    alongX
      ? {
          x: gridUnits(along),
          y: gridUnits(cross),
          width: gridUnits(alongLen),
          depth: gridUnits(crossLen),
        }
      : {
          x: gridUnits(cross),
          y: gridUnits(along),
          width: gridUnits(crossLen),
          depth: gridUnits(alongLen),
        };

  const rows: SlantedRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    const cross = cross0 + r * binCross;
    const fits = Math.floor((areaAlong + EPS) / binAlong);
    for (let count = Math.min(fits, maxPerRow); count >= 1; count--) {
      const starts = Array.from({ length: count }, (_, i) =>
        plan.sign === 1 ? along0 + i * binAlong : along0 + areaAlong - (i + 1) * binAlong
      );
      const bins = starts.map((start) => rect(start, cross, binAlong, binCross));
      const lead = bins[bins.length - 1];
      const probe: Bin = {
        ...lead,
        id: '__slanted_row__' as Bin['id'],
        layerId: '__slanted_row__' as Bin['layerId'],
        height: height as Bin['height'],
        category: '' as Bin['category'],
        label: '',
        notes: '',
        slant: { ...slant, endSupport: true },
      };
      const support = placedSlant(probe, layout)?.support;
      if (!support) break;
      const supportStart = alongX ? support.x : support.y;
      const supportEnd = supportStart + (alongX ? support.width : support.depth);
      if (supportStart < along0 - EPS || supportEnd > along0 + areaAlong + EPS) continue;
      rows.push({ bins, support });
      break;
    }
  }
  return rows;
}
