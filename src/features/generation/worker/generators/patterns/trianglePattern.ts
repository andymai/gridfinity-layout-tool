/**
 * Triangular-grid pattern calculator.
 *
 * An interlocked field of equilateral-triangle holes: apex-down triangles nest
 * between the apex-up ones (centroid R/2 above, half a period over), reading
 * as the classic triangular tessellation. This is a PERFORATION (uniform solid
 * web between every triangle), not a zero-web tessellation — the web keeps the
 * wall printable and rigid rather than leaving knife-edge struts. Per-element
 * flip is carried on each center's `rotation`.
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

/** drawPolysides(R, 3) already points its apex up (vertex 0 at +Y); 180° flips it down. */
const APEX_UP_DEG = 0;
const APEX_DOWN_DEG = 180;

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
    const w = this.webThickness;
    const halfWidth = (Math.sqrt(3) / 2) * R;
    // Interlocked classic tiling: each apex-down triangle nests between two
    // apex-up neighbours, its centroid R/2 ABOVE the up row and half a period
    // over. The slant web is exact: the gap between an up's right edge and
    // the next down's left edge is (sqrt3*dx + dy)/2 - R for a (dx, dy)
    // centroid offset, so dy = R/2 gives dx = sqrt3*R/2 + 2w/sqrt3.
    const dx = halfWidth + (2 / Math.sqrt(3)) * w;
    const period = 2 * dx;
    const rowSpacing = 1.5 * R + w;
    const maxX = fillW / 2 - halfWidth;
    const maxY = fillH / 2 - R;

    if (maxX < 0 || maxY < 0) return [];

    const centers: PatternCenter[] = [];
    // A down row rides R/2 above its up row, so up rows just below the
    // window can still contribute their downs.
    const startRow = Math.floor((-maxY - R / 2) / rowSpacing);
    const endRow = Math.ceil(maxY / rowSpacing);

    for (let row = startRow; row <= endRow; row++) {
      const yUp = row * rowSpacing;
      const xOffset = (row & 1) === 1 ? period / 2 : 0;
      if (Math.abs(yUp) <= maxY) {
        const startCol = Math.ceil((-maxX - xOffset) / period);
        const endCol = Math.floor((maxX - xOffset) / period);
        for (let col = startCol; col <= endCol; col++) {
          centers.push({ x: col * period + xOffset, y: yUp, rotation: APEX_UP_DEG });
        }
      }
      const yDown = yUp + R / 2;
      if (Math.abs(yDown) <= maxY) {
        const off = xOffset + dx;
        const startCol = Math.ceil((-maxX - off) / period);
        const endCol = Math.floor((maxX - off) / period);
        for (let col = startCol; col <= endCol; col++) {
          centers.push({ x: col * period + off, y: yDown, rotation: APEX_DOWN_DEG });
        }
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
