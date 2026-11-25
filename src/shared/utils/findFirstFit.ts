import { gridUnits } from '@/core/types';
import type { DesignId, GridUnits, HeightUnits, LayerId, Layout } from '@/core/types';
import { canPlaceBin } from './validation';

export interface FitRect {
  x: GridUnits;
  y: GridUnits;
  width: GridUnits;
  depth: GridUnits;
}

export interface FirstFitOptions {
  /** Position step in grid units: 1, or 0.5 on a half grid. */
  readonly step?: number;
  readonly linkedDesignId?: DesignId;
  /** A further check on a position that `canPlaceBin` accepts. */
  readonly accept?: (rect: FitRect) => boolean;
}

/**
 * First free position on `layerId`, scanning rows from the front-left, trying
 * the as-authored orientation and then width/depth swapped (canPlaceBin never
 * rotates).
 */
export function findFirstFit(
  layout: Layout,
  layerId: LayerId,
  width: number,
  depth: number,
  height: HeightUnits,
  { step = 1, linkedDesignId, accept }: FirstFitOptions = {}
): FitRect | null {
  const orientations =
    width === depth
      ? [{ width, depth }]
      : [
          { width, depth },
          { width: depth, depth: width },
        ];
  for (const orientation of orientations) {
    for (let y = 0; y <= layout.drawer.depth - orientation.depth; y += step) {
      for (let x = 0; x <= layout.drawer.width - orientation.width; x += step) {
        const rect = {
          x: gridUnits(x),
          y: gridUnits(y),
          width: gridUnits(orientation.width),
          depth: gridUnits(orientation.depth),
        };
        if (
          canPlaceBin({ ...rect, height, linkedDesignId }, layerId, layout).valid &&
          (accept === undefined || accept(rect))
        ) {
          return rect;
        }
      }
    }
  }
  return null;
}
