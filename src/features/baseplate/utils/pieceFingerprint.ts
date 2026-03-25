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
    `lw:${params.lightweight ? 1 : 0}`,
    `cr:${params.cornerRadius ?? 0}`,
  ];

  if (params.edges) {
    parts.push(
      `el:${params.edges.left}`,
      `er:${params.edges.right}`,
      `ef:${params.edges.front}`,
      `eb:${params.edges.back}`
    );
  }

  if (params.cornerRadii) {
    const cr = params.cornerRadii;
    parts.push(`cri:${cr.tl},${cr.tr},${cr.bl},${cr.br}`);
  }

  return parts.join('|');
}

/** A group of pieces sharing the same geometry fingerprint. */
export interface PieceGroup {
  /** Indices into the original tiling.pieces array */
  readonly indices: number[];
  /** Generation params for this group (from first piece) */
  readonly params: BaseplateParams;
  /** The fingerprint key */
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
  const groups = new Map<string, PieceGroup>();

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
