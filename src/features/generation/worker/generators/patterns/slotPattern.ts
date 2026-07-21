/**
 * Vertical-slot (louver) pattern calculator.
 *
 * A single row of full-height, lightly-rounded rectangular slots. Vertical
 * orientation prints reliably (the printer bridges across the slot width) and
 * drains naturally. Unlike the polygon patterns, the stamped shape's HEIGHT
 * depends on the fill area, so `getShapeDescriptor` reads `config.fillH`.
 *
 * Pure math module — no brepjs imports.
 */

import type {
  PatternCenter,
  PatternGridConfig,
  ShapeDescriptor,
  StampPatternCalculator,
} from './types';
import { PATTERN_WEB_THICKNESS, scaleFactor } from './patternScale';

/** Minimum wall height (mm) worth cutting a slot into. */
const MIN_SLOT_HEIGHT = 4;
/** Absolute floor on slot width (mm) so slats stay printable at fine scale. */
const MIN_SLOT_WIDTH = 1.6;

export class SlotPatternCalculator implements StampPatternCalculator {
  readonly strategy = 'stamp' as const;
  readonly slotWidth: number;
  readonly webThickness: number;

  constructor(slotWidth: number, webThickness = PATTERN_WEB_THICKNESS) {
    if (slotWidth <= 0) throw new Error('slotWidth must be positive');
    if (webThickness < 0) throw new Error('webThickness must be non-negative');
    this.slotWidth = slotWidth;
    this.webThickness = webThickness;
  }

  calculateCenters(config: PatternGridConfig): PatternCenter[] {
    const { fillW, fillH } = config;
    if (fillH < MIN_SLOT_HEIGHT) return [];
    // Louver rhythm: gaps roughly match the slat width for an even, open look.
    const gap = Math.max(2 * this.webThickness, this.slotWidth);
    const colSpacing = this.slotWidth + gap;
    const maxX = fillW / 2 - this.slotWidth / 2;
    if (maxX < 0) return [];

    const centers: PatternCenter[] = [];
    const startCol = Math.ceil(-maxX / colSpacing);
    const endCol = Math.floor(maxX / colSpacing);
    for (let col = startCol; col <= endCol; col++) {
      centers.push({ x: col * colSpacing, y: 0 });
    }
    return centers;
  }

  getShapeDescriptor(config: PatternGridConfig): ShapeDescriptor {
    return {
      kind: 'rect',
      width: this.slotWidth,
      height: config.fillH,
      cornerRadius: Math.min(this.slotWidth * 0.4, 1.2),
    };
  }

  /** Horizontal half-extent — the relevant bound for divider-bleed clipping.
   *  (Half-diagonal would over-clip since slots are full-height.) */
  getShapeRadius(): number {
    return this.slotWidth / 2;
  }

  getWebThickness(): number {
    return this.webThickness;
  }

  getPatternType(): string {
    return 'slots';
  }

  getMinPatternHeight(): number {
    return MIN_SLOT_HEIGHT;
  }
}

/** Factory with size-adaptive, scale-driven slot width. */
export function createSlotCalculator(binHeight: number, scale = 0.5): SlotPatternCalculator {
  const base = binHeight <= 3 ? 3.0 : 4.0;
  const slotWidth = Math.max(base * scaleFactor(scale), MIN_SLOT_WIDTH);
  return new SlotPatternCalculator(slotWidth);
}
