import type { Bin } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import type { BinShear } from '@/shared/hooks/useBinGeometry';
import type { SlantSupportRender } from '@/shared/hooks/useExplodedLayerView';
import { placedSlant, type SlantLayout } from './placedSlant';

/**
 * A slanted bin as the stylized 3D preview draws it: the shear for its box,
 * and the wedge its end support stands as. Scene units are grid units across
 * and mm over `gridUnitMm` up; the scene stretches depth by the Y pitch, so a
 * shift along it is given in Y grid units.
 */
export function slantRenderFields(
  bin: Bin,
  layout: SlantLayout
): { shear?: BinShear; slantSupport?: SlantSupportRender } {
  const slant = placedSlant(bin, layout);
  if (!slant) return {};
  const { plan, span, support } = slant;
  const pitchX = layout.gridUnitMm;
  const pitchY = effectiveGridUnitMmY(layout);
  const along = plan.sign * plan.k;
  const pivot = span.pivotZ / pitchX;
  // The stylized box stands at the bin's own height, without a linked design's
  // extra wall, so its wedge must too or it outgrows the box it holds up.
  const boxTopMm = bin.height * layout.heightUnitMm;
  const top = boxTopMm / pitchX;
  const shear: BinShear =
    plan.axis === 'x' ? { x: along, y: 0, pivot } : { x: 0, y: (along * pitchX) / pitchY, pivot };
  if (!support) return { shear };
  return {
    shear,
    slantSupport: {
      side: plan.side,
      x: support.x,
      y: support.y,
      width: support.width,
      depth: support.depth,
      reach: (plan.k * Math.max(0, boxTopMm - span.pivotZ)) / (plan.axis === 'x' ? pitchX : pitchY),
      pivot,
      top,
    },
  };
}
