/**
 * Role-based descriptive naming for deduplicated baseplate pieces.
 *
 * Classifies pieces by their edge topology: corner, edge-x, edge-y, center.
 * Falls back to sequential letters (piece-a, piece-b) for ambiguous topologies
 * like 1×N strips where the role names don't clearly apply.
 */

import type { PieceEdges, BaseplatePiece } from '../types/tiling';
import { isExteriorEdge } from '@/shared/types/bin';
import type { PieceGroup } from './pieceFingerprint';

type PieceRole = 'corner' | 'edge-x' | 'edge-y' | 'center';

/**
 * Classify a piece's role based on its edge topology.
 *
 * - corner: 2+ exterior edges (includes 3-exterior pieces in small grids)
 * - edge-x: exactly 1 exterior edge on left or right
 * - edge-y: exactly 1 exterior edge on front or back
 * - center: no exterior edges
 */
export function classifyPieceRole(edges: PieceEdges): PieceRole {
  // A marginSeam is a boundary edge (exterior + a tongue), so it counts toward
  // the piece's edge/corner role just like a plain exterior edge.
  const exteriorCount = [edges.left, edges.right, edges.front, edges.back].filter(
    isExteriorEdge
  ).length;

  if (exteriorCount >= 2) return 'corner';
  if (exteriorCount === 0) return 'center';

  // Exactly 1 exterior edge
  if (isExteriorEdge(edges.left) || isExteriorEdge(edges.right)) return 'edge-x';
  return 'edge-y';
}

/**
 * Assign unique descriptive file names to each fingerprint group.
 *
 * Returns a Map from fingerprint string → descriptive name (e.g. "corner", "edge-x").
 * When multiple groups share a role, numeric suffixes are added: "corner-1", "corner-2".
 * For 1×N or N×1 strips, falls back to "piece-a", "piece-b", etc.
 */
export function assignGroupNames(
  groups: Map<string, PieceGroup>,
  pieces: readonly BaseplatePiece[]
): Map<string, string> {
  const maxCol = Math.max(...pieces.map((p) => p.col));
  const maxRow = Math.max(...pieces.map((p) => p.row));
  const isStrip = maxCol === 0 || maxRow === 0;

  if (isStrip && groups.size > 1) {
    return assignSequentialNames(groups);
  }

  return assignRoleNames(groups, pieces);
}

function assignRoleNames(
  groups: Map<string, PieceGroup>,
  pieces: readonly BaseplatePiece[]
): Map<string, string> {
  const roleMap = new Map<string, PieceRole>();
  for (const [fp, group] of groups) {
    const piece = pieces[group.indices[0]];
    roleMap.set(fp, classifyPieceRole(piece.edges));
  }

  // Count occurrences of each role
  const roleCounts = new Map<PieceRole, number>();
  for (const role of roleMap.values()) {
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  const roleCounters = new Map<PieceRole, number>();

  for (const [fp, role] of roleMap) {
    const count = roleCounts.get(role) ?? 1;
    if (count === 1) {
      result.set(fp, role);
    } else {
      const idx = (roleCounters.get(role) ?? 0) + 1;
      roleCounters.set(role, idx);
      result.set(fp, `${role}-${idx}`);
    }
  }

  return result;
}

function indexToLabel(idx: number): string {
  if (idx < 26) return String.fromCharCode(97 + idx);
  return String(idx + 1);
}

function assignSequentialNames(groups: Map<string, PieceGroup>): Map<string, string> {
  const result = new Map<string, string>();
  let idx = 0;

  for (const fp of groups.keys()) {
    result.set(fp, `piece-${indexToLabel(idx)}`);
    idx++;
  }

  return result;
}
