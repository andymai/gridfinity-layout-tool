/**
 * Pattern system type definitions.
 *
 * Shared interfaces for wall pattern calculators. A pattern is one of two
 * strategies:
 *
 *   - `stamp`  — the fast path: a staggered grid of element centers, each
 *     stamped with one repeated shape (polygon or rounded rect). Honeycomb,
 *     round, diamond, triangle, and slots all use this.
 *   - `motif`  — the general path: a tiled unit cell of arbitrary 2D outlines
 *     (lines + arcs), in either `holes` (cut shapes out) or `lattice` (keep
 *     thin struts, open the rest) mode. Reserved for complex patterns such as
 *     asanoha / seigaiha. Typed and builder-supported here; no motif pattern
 *     ships in the registry yet.
 *
 * Pure-math module — NO brepjs imports. Motif geometry is emitted as data
 * (`MotifPath`); the builder layer converts it into brepjs Drawings. Keeping
 * this layer WASM-free is what lets the calculators run in plain unit tests.
 */

import type { KumikoBandConfig, KumikoLattice } from './kumiko/types';

/** Center position of a single pattern element (stamp strategy). */
export interface PatternCenter {
  readonly x: number;
  readonly y: number;
  /**
   * Optional per-element z-rotation in degrees, applied on top of the wall's
   * own rotation. Used by the triangle pattern to flip alternating elements.
   */
  readonly rotation?: number;
}

/** Configuration for pattern grid generation (all dimensions in mm). */
export interface PatternGridConfig {
  /** Width to fill — pattern elements stay within this boundary */
  readonly fillW: number;
  /** Height to fill — pattern elements stay within this boundary */
  readonly fillH: number;
}

/** A regular polygon prism element (hex, diamond, triangle, round). */
export interface PolygonShape {
  readonly kind: 'polygon';
  /** Circumradius (center to vertex, mm). */
  readonly radius: number;
  /** Number of polygon sides. High counts (~16+) approximate a circle. */
  readonly sides: number;
  /** Optional z-rotation of the shape template in degrees. */
  readonly rotation?: number;
}

/** A rounded-rectangle prism element (vertical slots / louvers). */
export interface RectShape {
  readonly kind: 'rect';
  readonly width: number;
  readonly height: number;
  /** Corner radius (mm). Lightly rounded corners print and read better. */
  readonly cornerRadius: number;
}

/** 2D shape stamped at each element center (stamp strategy). */
export type ShapeDescriptor = PolygonShape | RectShape;

/** Strategy discriminant for the pattern construction paths. */
export type PatternStrategyKind = 'stamp' | 'motif' | 'wrapped-lattice';

/** One segment of a motif outline, in cell-local coordinates (mm). */
export type MotifSegment =
  | { readonly kind: 'line'; readonly to: readonly [number, number] }
  | { readonly kind: 'arc'; readonly to: readonly [number, number]; readonly sagitta: number };

/** A single closed 2D outline within a motif unit cell (lines + arcs). */
export interface MotifPath {
  readonly start: readonly [number, number];
  readonly segments: readonly MotifSegment[];
  readonly closed: boolean;
}

/** Whether a motif's outlines are holes to remove or struts to keep. */
export type MotifMode = 'holes' | 'lattice';

/**
 * A repeating unit cell tiled across the wall panel.
 *
 * `holes` mode: outlines are cut out of the solid wall.
 * `lattice` mode: outlines are the solid struts to keep; the builder produces
 * `panel − struts` as the cut, so the wall opens up everywhere except the
 * struts (kumiko / asanoha behaviour).
 */
export interface MotifCell {
  readonly cellW: number;
  readonly cellH: number;
  /** Horizontal stagger applied to odd rows (mm). Defaults to 0. */
  readonly rowOffset?: number;
  readonly mode: MotifMode;
  /** Bounding radius of the cell's features — feeds clip-border sizing. */
  readonly boundingRadius: number;
  /** Closed outlines for one unit cell, in cell-local coordinates. */
  buildCellPaths(): readonly MotifPath[];
}

/** Members common to every pattern calculator, regardless of strategy. */
export interface BasePatternCalculator {
  /** Strategy discriminant — narrows the calculator to stamp vs motif. */
  readonly strategy: PatternStrategyKind;
  /** Pattern type identifier, used for cache key generation. */
  getPatternType(): string;
  /** Minimum wall height (mm) needed for at least one row of elements. */
  getMinPatternHeight(): number;
  /**
   * Bounding radius of a single element (mm). Feeds clip-border sizing
   * (`max(CUTOUT_BORDER_WIDTH, radius)`) so elements can't bleed into
   * divider walls, and contributes to cache keys.
   */
  getShapeRadius(): number;
}

/**
 * Fast-path calculator: element centers + one repeated shape.
 */
export interface StampPatternCalculator extends BasePatternCalculator {
  readonly strategy: 'stamp';
  /**
   * Calculate element center positions, strictly bounded within the fill
   * area. Empty array if the fill area is too small for any elements.
   */
  calculateCenters(config: PatternGridConfig): PatternCenter[];
  /**
   * The 2D shape stamped at each center. May depend on the fill area (a slot's
   * height is the fill height), so the resolved fill config is passed in.
   */
  getShapeDescriptor(config: PatternGridConfig): ShapeDescriptor;
  /** Solid web thickness between adjacent elements (mm). */
  getWebThickness(): number;
}

/**
 * General-path calculator: a tiled 2D motif. Reserved for complex patterns;
 * builder-supported and unit-tested, but not yet exposed in the registry.
 */
export interface MotifPatternCalculator extends BasePatternCalculator {
  readonly strategy: 'motif';
  /** The unit cell to tile across the wall panel for the given fill area. */
  getMotifCell(config: PatternGridConfig): MotifCell;
}

/**
 * Wrapped-lattice calculator (kumiko): stroked segments authored in unrolled
 * perimeter coordinates, wrapping continuously around all four walls and the
 * rounded corners. Built by `kumikoWrapBuilder`, not the stamp pipeline.
 */
export interface WrappedLatticeCalculator extends BasePatternCalculator {
  readonly strategy: 'wrapped-lattice';
  /** Resolve the full lattice for a perimeter band. */
  getLattice(band: KumikoBandConfig): KumikoLattice;
  /** Open-area fraction of the band at this scale (for print estimates). */
  getVoidFraction(): number;
}

/** A wall pattern calculator — one of the strategies. */
export type PatternCalculator =
  StampPatternCalculator | MotifPatternCalculator | WrappedLatticeCalculator;

/** Narrow a calculator to the stamp strategy. */
export function isStampCalculator(c: PatternCalculator): c is StampPatternCalculator {
  return c.strategy === 'stamp';
}

/** Narrow a calculator to the wrapped-lattice (kumiko) strategy. */
export function isWrappedLatticeCalculator(c: PatternCalculator): c is WrappedLatticeCalculator {
  return c.strategy === 'wrapped-lattice';
}

/** Stable cache-key fragment for a stamped shape descriptor. */
export function shapeDescriptorKey(d: ShapeDescriptor): string {
  return d.kind === 'polygon'
    ? `poly:${d.sides}:${Math.round(d.radius * 100)}:${Math.round((d.rotation ?? 0) * 100)}`
    : `rect:${Math.round(d.width * 100)}:${Math.round(d.height * 100)}:${Math.round(d.cornerRadius * 100)}`;
}
