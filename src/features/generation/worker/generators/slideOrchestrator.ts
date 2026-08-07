/**
 * Export path for the sliding tray's companion part.
 *
 * The tray is the piece that RIDES the rail; the rail itself is fused onto the
 * bin by `slideRailsFeature`. Both are resolved from `resolveSlideGeometry`, so
 * the exported tray is dimensioned against the same track the bin carries.
 *
 * Unlike `exportLid`, the solid is not reoriented: `buildSlideTray` already
 * returns it floor-down with its underside on Z=0, which is the print
 * orientation (walls up, no overhangs, nothing to bridge).
 */

import { exportSTEP } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { ExportFormat } from '../../bridge/types';
import { buildSlideTray } from './slideRailBuilder';
import { resolveSlideGeometry, slideInputFromDims } from './slideGeometry';
import { deriveDimensions } from './pipeline/context';
import { isPartialMask } from '@/shared/utils/cellMask';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';

export interface SlideTrayExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/** Resolver input for a bare `BinParams`, outside the generation pipeline. */
export function slideInputForParams(params: BinParams): ReturnType<typeof slideInputFromDims> {
  return slideInputFromDims(params, deriveDimensions(params, true), isPartialMask(params.cellMask));
}

/** True when this design produces a tray worth exporting. */
export function shouldGenerateSlideTray(params: BinParams): boolean {
  return resolveSlideGeometry(slideInputForParams(params)).tray !== null;
}

/**
 * Export the companion tray, or null when the config produces none — which
 * covers every rejection the resolver can return (a solid bin, a slotted bin,
 * a custom shape, a rail with no bearing), so the caller never has to repeat
 * those checks.
 */
export async function exportSlideTray(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<SlideTrayExportResult | null> {
  const solid = buildSlideTray(slideInputForParams(params));
  if (!solid) return null;

  const name = `gridfinity-${params.width}x${params.depth}-slide-tray`;
  try {
    if (format === 'step') {
      const blob = unwrapExportBlob(exportSTEP(solid), 'STEP');
      return { data: await blob.arrayBuffer(), fileName: `${name}.step` };
    }
    const data = await exportSolidToStl(solid, name, tolerance, angularTolerance);
    return { data, fileName: `${name}.stl` };
  } finally {
    solid.delete();
  }
}
