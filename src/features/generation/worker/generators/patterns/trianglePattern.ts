/**
 * Triangular-grid pattern calculator.
 *
 * A staggered field of equilateral-triangle holes whose orientation alternates
 * up / down in a checkerboard, reading as a classic triangular pattern. This is
 * a PERFORATION (solid web between every triangle), not a zero-web tessellation
 * — the web keeps the wall printable and rigid rather than leaving knife-edge
 * struts. Per-element flip is carried on each center's `rotation`.
 *
 * Equilateral triangle, circumradius R:
 *   side       = √3 R
 *   height     = 1.5 R   (apex R above centroid, base R/2 below)
 *
 * Pure math module — no brepjs imports.
 */

import type {
  PatternCenter,
  PatternGridConfig,
  ShapeDescriptor,
  StampPatternCalculator,
} from './types';
import { PATTERN_WEB_THICKNESS, resolveElementRadius } from './patternScale';

/** drawPolysides(R, 3) points its first vertex at +X; +90° stands the apex up. */
const APEX_UP_DEG = 90;
const APEX_DOWN_DEG = 270;

export class TrianglePatternCalculator implements StampPatternCalculator {
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
    const halfWidth = (Math.sqrt(3) / 2) * R;
    const colSpacing = Math.sqrt(3) * R + this.webThickness;
    const rowSpacing = 1.5 * R + this.webThickness;
    const maxX = fillW / 2 - halfWidth;
    const maxY = fillH / 2 - R;

    if (maxX < 0 || maxY < 0) return [];

    const centers: PatternCenter[] = [];
    const startRow = Math.floor(-maxY / rowSpacing);
    const endRow = Math.ceil(maxY / rowSpacing);

    for (let row = startRow; row <= endRow; row++) {
      const y = row * rowSpacing;
      if (Math.abs(y) > maxY) continue;
      const xOffset = (row & 1) === 1 ? colSpacing / 2 : 0;
      const startCol = Math.ceil((-maxX - xOffset) / colSpacing);
      const endCol = Math.floor((maxX - xOffset) / colSpacing);
      for (let col = startCol; col <= endCol; col++) {
        const x = col * colSpacing + xOffset;
        // Checkerboard flip: alternate apex up / down across rows and columns.
        const rotation = ((row + col) & 1) === 0 ? APEX_UP_DEG : APEX_DOWN_DEG;
        centers.push({ x, y, rotation });
      }
    }
    return centers;
  }

  getShapeDescriptor(): ShapeDescriptor {
    // Base orientation 0; per-center rotation carries the up/down flip.
    return { kind: 'polygon', radius: this.radius, sides: 3 };
  }

  getShapeRadius(): number {
    return this.radius;
  }

  getWebThickness(): number {
    return this.webThickness;
  }

  getPatternType(): string {
    return 'triangle';
  }

  getMinPatternHeight(): number {
    return 1.5 * this.radius + this.webThickness;
  }
}

/** Factory with size-adaptive, scale-driven radius. */
export function createTriangleCalculator(
  binHeight: number,
  scale = 0.5
): TrianglePatternCalculator {
  const base = binHeight <= 3 ? 2.6 : 4.0;
  return new TrianglePatternCalculator(resolveElementRadius(base, binHeight, scale));
}
