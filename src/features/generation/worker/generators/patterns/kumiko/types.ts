/**
 * Kumiko wrapped-lattice pattern types.
 *
 * Kumiko patterns are authored in UNROLLED wall coordinates: `u` is arc length
 * along the outer wall perimeter (a closed loop of period P), `z` is height
 * within the pattern band. Every motif is a set of stroked line segments — the
 * triangular jigumi grid plus per-vertex "filling" segments — matching how
 * traditional kumiko is assembled. The builder maps segments back onto the
 * wall: flat spans extrude, corner spans revolve/helix-sweep.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { WallPatternType } from '@/shared/types/bin';

/** A stroked lattice segment in unrolled (u, z) coordinates (mm). */
export interface KumikoSegment {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
}

/** A lattice vertex of the jigumi grid, with its column/row indices. */
export interface KumikoVertex {
  readonly u: number;
  readonly z: number;
}

/**
 * Per-vertex filling generator: segments a pattern adds around one jigumi
 * vertex, in absolute (u, z) coordinates. `cellSize` is the triangle edge
 * length; `columnPitch` is the u-distance between vertical struts
 * (= cellSize·√3/2). Mitsukude returns none — the bare grid IS the pattern.
 */
export type KumikoFilling = (
  vertex: KumikoVertex,
  cellSize: number,
  columnPitch: number
) => readonly KumikoSegment[];

/** Definition of one kumiko pattern: identity + its vertex filling. */
export interface KumikoPatternDef {
  /** Pattern type id — the registry entry this definition backs. */
  readonly id: WallPatternType;
  /** Filling segments per jigumi vertex; undefined for the bare grid. */
  readonly filling?: KumikoFilling;
  /**
   * Approximate open-area fraction of the band at neutral scale, used by
   * print estimates. Derived from strut coverage of the unit cell.
   */
  readonly voidFraction: number;
}

/** Resolved lattice for one bin: all segments plus the quantized metrics. */
export interface KumikoLattice {
  readonly segments: readonly KumikoSegment[];
  /** Strut stroke width (mm). */
  readonly strutWidth: number;
  /** Quantized u-distance between vertical strut columns (mm). */
  readonly columnPitch: number;
  /** Quantized triangle edge length (mm). */
  readonly cellSize: number;
}

/** Band geometry the lattice is generated for. */
export interface KumikoBandConfig {
  /** Closed perimeter length P (mm) — the lattice tiles seamlessly modulo P. */
  readonly perimeter: number;
  /** Pattern band height (mm). */
  readonly bandHeight: number;
}
