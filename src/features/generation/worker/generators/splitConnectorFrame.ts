/**
 * The frame split connectors are placed in: the cut faces a piece carries and
 * the bin geometry around them, plus the tolerances every connector builds to.
 */

import type { ResolvedTaper } from './overhang';

/** Overlap into the piece body so booleans have shared volume (mm). */
export const OVERLAP = 1.0;

/** Minimum printable feature width for horizontal features (mm, ~2× nozzle). */
export const MIN_FEATURE_WIDTH = 0.7;

/** Minimum feature height (mm) for reliable OCCT boolean operations. */
export const MIN_FEATURE_HEIGHT = 0.5;

/** Tolerance for floating-point mm comparisons. */
export const EPSILON = 1e-9;

export interface CutFace {
  readonly axis: 'x' | 'y';
  readonly position: number;
  readonly isMale: boolean;
  /**
   * Perpendicular coordinates of the bin's two exterior walls this cut crosses.
   * These are the *actual* body edges, which an overhang pushes outward and can
   * make asymmetric (left ≠ right) — not the nominal ±footprint/2. Connector
   * placement keys off these so overhung walls are detected and the connector
   * lands on the true outer face.
   */
  readonly binEdgeMin: number;
  readonly binEdgeMax: number;
  readonly pieceEdgeLength: number;
  readonly pieceCenterOffset: number;
  readonly perpendicularCuts: readonly number[];
}

export interface BinGeometryContext {
  readonly floorZ: number;
  readonly wallTopZ: number;
  readonly wallThickness: number;
  readonly floorThickness: number;
  /**
   * Nozzle diameter (mm) the pieces print with. Drives feature/clearance scaling
   * so connectors stay printable on wider nozzles. Defaults to the 0.4mm baseline
   * when omitted, leaving geometry identical to pre-nozzle-aware behavior.
   */
  readonly nozzleSizeMm?: number;
  /**
   * Outer-wall taper of the body being split. Below its band a tapered wall
   * stands inboard of the rim edge the cut faces report, so connectors on it
   * are placed off the wall's face at each height, not off that edge.
   */
  readonly taper?: ResolvedTaper | null;
}
