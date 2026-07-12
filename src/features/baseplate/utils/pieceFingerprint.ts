/**
 * Fingerprinting for baseplate split pieces.
 *
 * Computes a stable, deterministic string key from all geometry-affecting
 * ResolvedBaseplateParams fields. Pieces with identical fingerprints produce
 * byte-identical BREP output and can be cloned instead of regenerated.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { hashOutline } from '@/shared/utils/drawerOutline';
import { exteriorCorners, type CornerKey } from '@/shared/generation/baseplateCorners';
import type { BaseplatePiece } from '../types/tiling';
import { pieceToBaseplateParams } from './splitPlanner';

/**
 * Compute a stable fingerprint for a set of baseplate generation params.
 * Every field that affects BREP geometry output is included.
 *
 * Uses `|` as field delimiter and `:` as key-value separator.
 * Field values must not contain these characters (safe for current
 * numeric, boolean, and short enum values in ResolvedBaseplateParams).
 *
 * Under `preferIdenticalPieces`, the edge classification is canonicalized so
 * pieces whose join/exterior layout is a 180° rotation of each other share a
 * fingerprint. Combined with the doubled-dovetail connector pattern (which is
 * itself 180° rotation invariant), this means A1 and C2 — and more generally
 * any opposite-corner pair in the tiling — produce the same canonical mesh.
 */
export function computePieceFingerprint(params: ResolvedBaseplateParams): string {
  const parts = [
    `w:${params.width}`,
    `d:${params.depth}`,
    `g:${params.gridUnitMm}`,
    `mh:${params.magnetHoles ? 1 : 0}`,
    `md:${params.magnetDiameter}`,
    `mz:${params.magnetDepth}`,
    `pl:${params.paddingLeft}`,
    `pr:${params.paddingRight}`,
    `pf:${params.paddingFront}`,
    `pb:${params.paddingBack}`,
    `fx:${params.fractionalEdgeX}`,
    `fy:${params.fractionalEdgeY}`,
    `cn:${params.connectorNubs ? 1 : 0}`,
    // invertDovetails is ignored by buildConnectors in paired mode, so
    // normalize it to 0 there to avoid false cache misses between sessions
    // that differ only in the persisted invertDovetails value.
    `id:${params.preferIdenticalPieces ? 0 : params.invertDovetails ? 1 : 0}`,
    `ip:${params.preferIdenticalPieces ? 1 : 0}`,
    `cs:${params.connectorStyle ?? 'dovetail'}`,
    `lw:${params.lightweight ? 1 : 0}`,
    // Solid floor changes slab height + through-cut, and (with magnets) keeps the
    // underside continuous — so floored and hollow pieces must never dedupe. The
    // thickness only bites when solidFloor is on, so gate it to avoid false misses.
    `sf:${params.solidFloor ? 1 : 0}`,
    `sft:${params.solidFloor ? (params.solidFloorThickness ?? '') : ''}`,
    params.cornerRadius === undefined ? 'cr:default' : `cr:${params.cornerRadius}`,
  ];

  // Piece-local outline hash. Deliberately conservative: it hashes the WHOLE
  // translated loop, so two windows only dedupe when their entire local view
  // of the boundary matches — windows whose in-slab geometry is identical but
  // whose far-away loop parts differ regenerate separately. Correctness is
  // unaffected (only generation time); a window-clipped canonical form would
  // need the 2D polygon clipping this design avoids. Fully-inside pieces
  // carry no outline and keep sharing entries with plain rectangles.
  if (params.outline !== undefined) {
    parts.push(`ol:${hashOutline(params.outline)}`);
  }

  // Edge classification (exterior vs join) affects geometry through two
  // independent channels — and keying on the raw labels over-distinguishes
  // pieces that are actually identical:
  //
  //   - Connectors are placed on join edges, so when they're on the full edge
  //     layout matters. Canonicalize under preferIdenticalPieces so 180°-rotated
  //     pairs share a key — but ONLY here, where the placement actually applies
  //     the compensating rotation (it's gated on connectorNubs too). Doing it
  //     without connectors would merge two pieces whose meshes then get placed
  //     un-rotated → a rounded corner on the wrong side.
  //   - Corner rounding rounds a corner iff it is *exterior* (both adjacent
  //     edges exterior) AND its radius > 0 — matching `buildSlabProfile` /
  //     `resolveCornerRadii`. So with connectors off, edges matter only through
  //     which corners actually round — key on that, not the raw labels, so edge
  //     and interior pieces (no rounded corner) dedupe with each other.
  //
  // When no corner actually rounds (square corners, or all-zero cornerRadii),
  // edges don't affect geometry at all, so nothing is added (key for stack-print
  // tiles). Padding is captured separately, so padded edge pieces still differ.
  if (params.edges) {
    const canon = params.preferIdenticalPieces ? canonicalizeEdges(params.edges) : params.edges;
    // A margin-seam tongue (#2414) is body geometry the piece carries
    // independently of split connectors (`connectorNubs`), so it must ALWAYS
    // distinguish the fingerprint — otherwise a tongued piece dedupes with a
    // plain exterior one and the export reuses a tongue-less mesh.
    const ms = `${+(canon.left === 'marginSeam')}${+(canon.right === 'marginSeam')}${+(canon.front === 'marginSeam')}${+(canon.back === 'marginSeam')}`;
    if (ms !== '0000') parts.push(`ms:${ms}`);
    if (params.connectorNubs === true) {
      parts.push(`el:${canon.left}`, `er:${canon.right}`, `ef:${canon.front}`, `eb:${canon.back}`);
    } else {
      // Per-corner nominal radius (mirrors resolveCornerRadii precedence:
      // cornerRadii wins, else the uniform cornerRadius, whose absence defaults
      // to the positive plate radius). Only the >0 test matters here.
      const cr = params.cornerRadii;
      const hasRadius = (k: CornerKey): boolean => (cr ? cr[k] > 0 : params.cornerRadius !== 0);
      const ext = exteriorCorners(params.edges);
      const rounds = (k: CornerKey): boolean => ext[k] && hasRadius(k);
      if (rounds('tl') || rounds('tr') || rounds('bl') || rounds('br')) {
        parts.push(`rc:${+rounds('tl')}${+rounds('tr')}${+rounds('bl')}${+rounds('br')}`);
      }
    }
  }

  if (params.cornerRadii) {
    const cr = params.cornerRadii;
    parts.push(`cri:${cr.tl},${cr.tr},${cr.bl},${cr.br}`);
  }

  return parts.join('|');
}

/**
 * Canonicalize an edge layout under 180° rotation.
 *
 * A 180° rotation swaps left↔right and front↔back. Returns the
 * lexicographically smaller of the two possible representations so both forms
 * map to the same canonical string.
 */
function canonicalizeEdges(
  edges: NonNullable<ResolvedBaseplateParams['edges']>
): NonNullable<ResolvedBaseplateParams['edges']> {
  const rotated = {
    left: edges.right,
    right: edges.left,
    front: edges.back,
    back: edges.front,
  };
  const a = `${edges.left}|${edges.right}|${edges.front}|${edges.back}`;
  const b = `${rotated.left}|${rotated.right}|${rotated.front}|${rotated.back}`;
  return a <= b ? edges : rotated;
}

/** A group of pieces sharing the same geometry fingerprint. */
export interface PieceGroup {
  /** Indices into the original tiling.pieces array (mutable during grouping) */
  readonly indices: readonly number[];
  /** Generation params for this group (from first piece) */
  readonly params: ResolvedBaseplateParams;
  /** The fingerprint key */
  readonly fingerprint: string;
}

/** Mutable version used internally during grouping. */
interface MutablePieceGroup {
  readonly indices: number[];
  readonly params: ResolvedBaseplateParams;
  readonly fingerprint: string;
}

/**
 * Group tiling pieces by their generation fingerprint.
 *
 * Returns a Map keyed by fingerprint string. Each value contains the
 * original piece indices that share that geometry, plus the ResolvedBaseplateParams
 * to use for generation (from the first piece in the group).
 */
export function groupPiecesByFingerprint(
  pieces: readonly BaseplatePiece[],
  parentParams: ResolvedBaseplateParams
): Map<string, PieceGroup> {
  const groups = new Map<string, MutablePieceGroup>();

  for (let i = 0; i < pieces.length; i++) {
    const pieceParams = pieceToBaseplateParams(pieces[i], parentParams);
    const fp = computePieceFingerprint(pieceParams);

    const existing = groups.get(fp);
    if (existing) {
      existing.indices.push(i);
    } else {
      groups.set(fp, { indices: [i], params: pieceParams, fingerprint: fp });
    }
  }

  return groups;
}
