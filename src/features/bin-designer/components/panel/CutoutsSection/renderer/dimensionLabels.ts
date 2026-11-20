import type { Cutout } from '@/features/bin-designer/types';
import { rotatePoint } from '../geometryCore';

type Point = readonly [number, number];

/**
 * Where the width and depth labels sit: `offset` mm outside the middle of the
 * edge each one measures, turned with the shape. The renderer turns a cutout
 * by `-rotation`, so the labels do too.
 */
export function dimensionLabelPositions(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  offset: number
): { readonly width: Point; readonly depth: Point } {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const at = (dx: number, dy: number): Point => {
    const p = rotatePoint(cx + dx, cy + dy, cx, cy, -cutout.rotation);
    return [p.x, p.y];
  };
  return {
    width: at(0, -cutout.depth / 2 - offset),
    depth: at(-cutout.width / 2 - offset, 0),
  };
}
