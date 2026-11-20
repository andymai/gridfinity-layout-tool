import type { Cutout } from '@/features/bin-designer/types';
import { rotatePoint } from '../geometryCore';

type Point = readonly [number, number];

interface DimensionLabel {
  readonly text: string;
  readonly at: Point;
}

/**
 * The chip is `text-micro` mono with `px-1`: about 6.2px per character, 8px of
 * padding and a 14px line. The gap keeps it clear of the edge's handles.
 */
const CHAR_PX = 6.2;
const PAD_PX = 8;
const HALF_HEIGHT_PX = 7;
const GAP_PX = 9;
const TIE = 1e-9;

type Normal = { readonly x: number; readonly y: number };

const lower = (a: Normal, b: Normal): Normal =>
  Math.abs(a.y - b.y) > TIE ? (a.y < b.y ? a : b) : a.x <= b.x ? a : b;
const lefter = (a: Normal, b: Normal): Normal =>
  Math.abs(a.x - b.x) > TIE ? (a.x < b.x ? a : b) : a.y <= b.y ? a : b;

/**
 * Where the width and depth labels sit, beside the middle of an edge each one
 * measures, turned with the shape (the renderer turns a cutout by `-rotation`).
 *
 * Each size has two such edges. The width takes the one facing down and the
 * depth the one facing left, so neither lands under the rotation handle, which
 * always sits above the shape. The gap is measured in screen pixels along the
 * edge's normal, so a horizontal chip clears a vertical edge by half its width.
 */
export function dimensionLabelPositions(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  zoom: number
): { readonly width: DimensionLabel; readonly depth: DimensionLabel } {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const turn = (x: number, y: number): Normal => rotatePoint(x, y, 0, 0, -cutout.rotation);

  const place = (text: string, n: Normal, halfExtent: number): DimensionLabel => {
    const halfWidthPx = (text.length * CHAR_PX + PAD_PX) / 2;
    const gap = (GAP_PX + Math.abs(n.x) * halfWidthPx + Math.abs(n.y) * HALF_HEIGHT_PX) / zoom;
    const reach = halfExtent + gap;
    return { text, at: [cx + n.x * reach, cy + n.y * reach] };
  };

  const width = place(
    `${cutout.width.toFixed(1)}mm`,
    lower(turn(0, -1), turn(0, 1)),
    cutout.depth / 2
  );
  const depth = place(
    `${cutout.depth.toFixed(1)}mm`,
    lefter(turn(-1, 0), turn(1, 0)),
    cutout.width / 2
  );
  return { width, depth };
}
