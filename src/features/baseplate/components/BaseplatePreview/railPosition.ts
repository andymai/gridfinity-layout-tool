import type { MarginMeshEntry } from '../../store/baseplatePageStore';
import { EXPLODE_GAP_MM } from '../../constants';

/** Extra outward gap (mm) so a rail reads as detached from its body piece. */
export const MARGIN_OUTWARD_GAP_MM = 8;

export const SIDE_NORMAL: Record<MarginMeshEntry['side'], readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  front: [0, -1],
  back: [0, 1],
};

/** Tower-field extents (mm, centered at origin) while stack-print previews. */
export interface StackFieldSize {
  readonly widthMm: number;
  readonly depthMm: number;
}

/**
 * Scene XY for a rail. Assembled: its world offset. Exploded: tracks the
 * adjacent body piece (col/row × gap, matching SplitBaseplateMeshes) then steps
 * outward along the side normal so the rail visibly separates. Stack-print: the
 * assembled body is replaced by the tower field (centered at origin, different
 * footprint), so the normal-axis coordinate re-anchors just outside that field
 * while the tangential coordinate keeps its assembled value (stack-print
 * overrides exploded).
 */
export function railPosition(
  entry: Pick<MarginMeshEntry, 'side' | 'worldOffsetMm' | 'bandThicknessMm' | 'col' | 'row'>,
  exploded: boolean,
  stackField?: StackFieldSize | null
): { x: number; y: number } {
  const [nx, ny] = SIDE_NORMAL[entry.side];
  let x = entry.worldOffsetMm.x;
  let y = entry.worldOffsetMm.y;
  if (stackField) {
    const clearance = entry.bandThicknessMm / 2 + MARGIN_OUTWARD_GAP_MM;
    if (nx !== 0) x = nx * (stackField.widthMm / 2 + clearance);
    else y = ny * (stackField.depthMm / 2 + clearance);
  } else if (exploded) {
    x += entry.col * EXPLODE_GAP_MM + nx * MARGIN_OUTWARD_GAP_MM;
    y += entry.row * EXPLODE_GAP_MM + ny * MARGIN_OUTWARD_GAP_MM;
  }
  return { x, y };
}
