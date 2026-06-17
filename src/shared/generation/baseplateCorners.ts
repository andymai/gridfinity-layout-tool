/**
 * Which baseplate corners are "exterior" — i.e. eligible for corner rounding.
 *
 * A corner rounds only when BOTH of its adjacent edges are exterior (not a join
 * seam between split pieces). This is the single source of truth shared by:
 *   - `buildSlabProfile` (baseplateSlab.ts), which actually rounds them, and
 *   - `computePieceFingerprint` (pieceFingerprint.ts), which dedupes pieces by
 *     the set of corners that round (so geometrically-identical edge/interior
 *     pieces collapse instead of being split apart by raw edge labels).
 *
 * Keep these two in lockstep: if the rounding predicate ever changes, the dedup
 * fingerprint must change with it or pieces will be wrongly merged or split.
 */

import type { BaseplateParams } from '@/shared/types/bin';

export type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

/**
 * Map each corner to whether both its adjacent edges are exterior. With no edge
 * classification (a standalone, unsplit plate) every corner is exterior.
 */
export function exteriorCorners(edges: BaseplateParams['edges']): Record<CornerKey, boolean> {
  if (!edges) return { tl: true, tr: true, bl: true, br: true };
  return {
    tl: edges.left === 'exterior' && edges.back === 'exterior',
    tr: edges.right === 'exterior' && edges.back === 'exterior',
    bl: edges.left === 'exterior' && edges.front === 'exterior',
    br: edges.right === 'exterior' && edges.front === 'exterior',
  };
}
