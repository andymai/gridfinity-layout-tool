/**
 * Round-hole (perforated) pattern calculator.
 *
 * Hex-close-packed circular holes, each approximated by a 16-sided polygon
 * (indistinguishable from a circle at print resolution, far cheaper to boolean
 * than a true NURBS circle). Pure math module — no brepjs imports.
 */

import type {
  PatternCenter,
  PatternGridConfig,
  ShapeDescriptor,
  StampPatternCalculator,
} from './types';
import { calculateStaggeredGrid } from './gridUtils';
import { PATTERN_WEB_THICKNESS, resolveElementRadius } from './patternScale';

/** Polygon sides used to approximate a circular hole. */
export const ROUND_SIDES = 16;

export class RoundPatternCalculator implements StampPatternCalculator {
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
    // Hex-close-pack circles: columns 2R+web apart, rows staggered by half.
    const colSpacing = 2 * R + this.webThickness;
    const rowSpacing = (Math.sqrt(3) / 2) * colSpacing;
    const maxX = fillW / 2 - R;
    const maxY = fillH / 2 - R;
    return calculateStaggeredGrid({ maxX, maxY, colSpacing, rowSpacing });
  }

  getShapeDescriptor(): ShapeDescriptor {
    return { kind: 'polygon', radius: this.radius, sides: ROUND_SIDES };
  }

  getShapeRadius(): number {
    return this.radius;
  }

  getWebThickness(): number {
    return this.webThickness;
  }

  getPatternType(): string {
    return 'round';
  }

  getMinPatternHeight(): number {
    return 2 * this.radius + this.webThickness;
  }
}

/** Factory with size-adaptive, scale-driven radius. */
export function createRoundCalculator(binHeight: number, scale = 0.5): RoundPatternCalculator {
  const base = binHeight <= 3 ? 1.6 : 2.6;
  return new RoundPatternCalculator(resolveElementRadius(base, binHeight, scale));
}
