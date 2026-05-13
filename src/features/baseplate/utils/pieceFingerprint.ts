/**
 * Fingerprinting for baseplate split pieces.
 *
 * Computes a stable, deterministic string key from all geometry-affecting
 * BaseplateParams fields. Pieces with identical fingerprints produce
 * byte-identical BREP output and can be cloned instead of regenerated.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece } from '../types/tiling';
import { pieceToBaseplateParams } from './splitPlanner';

/**
 * Compute a stable fingerprint for a set of baseplate generation params.
 * Every field that affects BREP geometry output is included.
 *
 * Uses `|` as field delimiter and `:` as key-value separator.
 * Field values must not contain these characters (safe for current
 * numeric, boolean, and short enum values in BaseplateParams).
 *
 * Under `preferIdenticalPieces`, the edge classification is canonicalized so
 * pieces whose join/exterior layout is a 180° rotation of each other share a
 * fingerprint. Combined with the doubled-dovetail connector pattern (which is
 * itself 180° rotation invariant), this means A1 and C2 — and more generally
 * any opposite-corner pair in the tiling — produce the same canonical mesh.
 */
export function computePieceFingerprint(params: BaseplateParams): string {
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
    `lw:${params.lightweight ? 1 : 0}`,
    params.cornerRadius === undefined ? 'cr:default' : `cr:${params.cornerRadius}`,
  ];

  if (params.edges) {
    const e = params.preferIdenticalPieces ? canonicalizeEdges(params.edges) : params.edges;
    parts.push(`el:${e.left}`, `er:${e.right}`, `ef:${e.front}`, `eb:${e.back}`);
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
  edges: NonNullable<BaseplateParams['edges']>
): NonNullable<BaseplateParams['edges']> {
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
  readonly params: BaseplateParams;
  /** The fingerprint key */
  readonly fingerprint: string;
}

/** Mutable version used internally during grouping. */
interface MutablePieceGroup {
  readonly indices: number[];
  readonly params: BaseplateParams;
  readonly fingerprint: string;
}

/**
 * Group tiling pieces by their generation fingerprint.
 *
 * Returns a Map keyed by fingerprint string. Each value contains the
 * original piece indices that share that geometry, plus the BaseplateParams
 * to use for generation (from the first piece in the group).
 */
export function groupPiecesByFingerprint(
  pieces: readonly BaseplatePiece[],
  parentParams: BaseplateParams
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
