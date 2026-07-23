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
  /** Stroke width override (mm); the lattice strut width when omitted. */
  readonly width?: number;
}

/** A lattice vertex of the jigumi grid, with its column/row indices. */
export interface KumikoVertex {
  readonly u: number;
  readonly z: number;
}

/**
 * Vertex filling template generator: the segments a pattern adds around a
 * jigumi vertex, in VERTEX-LOCAL coordinates (the vertex at the origin).
 * `cellSize` is the triangle edge length; `columnPitch` is the u-distance
 * between vertical struts (= cellSize·√3/2). The template is identical at
 * every vertex, which is what lets the builders prefabricate one filling
 * solid and stamp copies. Mitsukude returns none — the bare grid IS the
 * pattern.
 */
export type KumikoFilling = (cellSize: number, columnPitch: number) => readonly KumikoSegment[];

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
  /**
   * Neutral triangle edge length (mm) before the scale factor. Filled
   * patterns default larger than the bare grid: it matches the reference
   * bins' star density, and boolean cost scales with vertex count (∝ 1/s²).
   */
  readonly baseCellSize?: number;
  /**
   * Column-count ceiling around the perimeter. Filled patterns bound this
   * low: it keeps their star size proportional to the bin AND bounds the
   * per-wall boolean tool count, so generation cost scales with wall count
   * rather than wall area.
   */
  readonly maxColumns?: number;
}

/** Resolved lattice for one bin: jigumi grid plus the vertex filling. */
export interface KumikoLattice {
  /** The jigumi grid segments (verticals + diagonals), band-clipped. */
  readonly segments: readonly KumikoSegment[];
  /**
   * The pattern's vertex filling in vertex-local coordinates — identical at
   * every vertex, so builders stamp one prefabricated solid per vertex
   * instead of building each segment. Empty for the bare grid.
   */
  readonly fillingTemplate: readonly KumikoSegment[];
  /** Jigumi vertices within the band (u in [0, perimeter)), band-local z. */
  readonly vertices: readonly KumikoVertex[];
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
