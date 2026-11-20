import type { Cutout } from '@/features/bin-designer/types';
import { rotatePoint } from '../geometryCore';
import { smallCutoutHandleOffsetPx } from './handleOffset';

type Point = readonly [number, number];

interface DimensionLabel {
  readonly text: string;
  readonly at: Point;
}

/** Keep in sync with the chip's `text-micro font-mono px-1` in DimensionAnnotations3D. */
const CHAR_PX = 6.2;
const PAD_PX = 8;
const HALF_HEIGHT_PX = 7;
const GAP_PX = 9;
const TIE = 1e-9;

type Normal = { readonly x: number; readonly y: number };

/** The board area on screen, in board mm. */
export interface ViewBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The edge facing further down, or on a tie the one facing left. */
const lower = (a: Normal, b: Normal): Normal =>
  Math.abs(a.y - b.y) > TIE ? (a.y < b.y ? a : b) : a.x <= b.x ? a : b;

/**
 * Where the width and depth labels sit, beside the middle of an edge each one
 * measures, turned with the shape (the renderer turns a cutout by `-rotation`).
 *
 * Each size has two such edges and takes the one facing down, so neither label
 * lands under the rotation handle, which always sits above the shape. The gap
 * is measured in screen pixels along the edge's normal, so a horizontal chip
 * clears a vertical edge by half its width. It also clears the handles that a
 * small cutout moves out, and grows with the root font size (`remPx`). A chip
 * that would leave `view` moves to the other edge, unless that edge faces up.
 */
export function dimensionLabelPositions(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  zoom: number,
  remPx = 16,
  view?: ViewBounds
): { readonly width: DimensionLabel; readonly depth: DimensionLabel } {
  const scale = remPx / 16;
  const handlePx = smallCutoutHandleOffsetPx(cutout.width, cutout.depth, zoom);
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const turn = (x: number, y: number): Normal => rotatePoint(x, y, 0, 0, -cutout.rotation);

  const place = (text: string, pair: readonly [Normal, Normal], halfExtent: number) => {
    const halfW = (((text.length * CHAR_PX + PAD_PX) / 2) * scale) / zoom;
    const halfH = (HALF_HEIGHT_PX * scale) / zoom;
    const at = (n: Normal): Point => {
      const gap = (GAP_PX + handlePx) / zoom + Math.abs(n.x) * halfW + Math.abs(n.y) * halfH;
      return [cx + n.x * (halfExtent + gap), cy + n.y * (halfExtent + gap)];
    };
    const inView = ([x, y]: Point): boolean =>
      !view ||
      (x - halfW >= view.minX &&
        x + halfW <= view.maxX &&
        y - halfH >= view.minY &&
        y + halfH <= view.maxY);

    const first = lower(pair[0], pair[1]);
    const second = first === pair[0] ? pair[1] : pair[0];
    const preferred = at(first);
    // The other edge may face up, where the rotation handle sits.
    if (inView(preferred) || second.y > TIE) return { text, at: preferred };
    const other = at(second);
    return { text, at: inView(other) ? other : preferred };
  };

  const width = place(`${cutout.width.toFixed(1)}mm`, [turn(0, -1), turn(0, 1)], cutout.depth / 2);
  const depth = place(`${cutout.depth.toFixed(1)}mm`, [turn(-1, 0), turn(1, 0)], cutout.width / 2);
  return { width, depth };
}
