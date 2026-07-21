/**
 * Diamond-lattice (argyle) pattern calculator.
 *
 * Axis-aligned grid of squares rotated 45°, reading as a diamond lattice. The
 * aligned (non-staggered) grid gives the clean argyle look. Pure math module —
 * no brepjs imports.
 */

import type {
  PatternCenter,
  PatternGridConfig,
  ShapeDescriptor,
  StampPatternCalculator,
} from './types';
import { calculateAlignedGrid } from './gridUtils';
import { PATTERN_WEB_THICKNESS, resolveElementRadius } from './patternScale';

export class DiamondPatternCalculator implements StampPatternCalculator {
  readonly strategy = 'stamp' as const;
  readonly radius: number;
  readonly webThickness: number;

  constructor(radius: number, webThickness = PATTERN_WEB_THICKNESS) {
    if (radius <= 0) throw new Error('radius must be positive');
    if (webThickness < 0) throw new Error('webThickness must be non-negative');
    this.radius = radius;
    this.webThickness = webThickness;
  }

  calculateCenters(config: PatternGridConfig): PatternCenter[] {
    const { fillW, fillH } = config;
    const R = this.radius;
    // Diamond (square rotated 45°) spans 2R vertex-to-vertex on both axes.
    const spacing = 2 * R + this.webThickness;
    const maxX = fillW / 2 - R;
    const maxY = fillH / 2 - R;
    return calculateAlignedGrid({ maxX, maxY, colSpacing: spacing, rowSpacing: spacing });
  }

  getShapeDescriptor(): ShapeDescriptor {
    // drawPolysides places vertex 0 at the top, so a 4-gon is already on-point
    // (a diamond); no rotation needed. Rotating 45° would flatten it to a square.
    return { kind: 'polygon', radius: this.radius, sides: 4 };
  }

  getShapeRadius(): number {
    return this.radius;
  }

  getWebThickness(): number {
    return this.webThickness;
  }

  getPatternType(): string {
    return 'diamond';
  }

  getMinPatternHeight(): number {
    return 2 * this.radius + this.webThickness;
  }
}

/** Factory with size-adaptive, scale-driven radius. */
export function createDiamondCalculator(binHeight: number, scale = 0.5): DiamondPatternCalculator {
  const base = binHeight <= 3 ? 2.0 : 3.2;
  return new DiamondPatternCalculator(resolveElementRadius(base, binHeight, scale));
}
