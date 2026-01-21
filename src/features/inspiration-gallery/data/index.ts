import type { InspirationLayout, InspirationTheme } from '../types';
import {
  KITCHEN_LAYOUTS,
  WORKSHOP_LAYOUTS,
  OFFICE_LAYOUTS,
  HOBBY_LAYOUTS,
  PERSONAL_LAYOUTS,
} from './themes';

// ============================================================
// LAYOUT ORDERING HELPERS
// ============================================================

/**
 * Select layouts from a source array in a specific order, with validation.
 * Throws an error if any expected ID is missing from the source.
 */
function pickLayouts(
  layouts: InspirationLayout[],
  orderedIds: string[],
): InspirationLayout[] {
  const byId = new Map(layouts.map((layout) => [layout.id, layout]));
  const result: InspirationLayout[] = [];

  for (const id of orderedIds) {
    const layout = byId.get(id);
    if (!layout) {
      throw new Error(
        `Inspiration layout with id "${id}" is missing from its theme source.`,
      );
    }
    result.push(layout);
  }

  return result;
}

// ============================================================
// EXPORT ALL LAYOUTS
// ============================================================

// Ordered by popularity based on telemetry data:
// - Vocabulary tracking shows fasteners, tools, electronics, 3D printing hardware most common
// - Gridfinity core users are makers/3D printing enthusiasts
//
// Layouts are organized by theme files but assembled here in popularity order.
// The original order was:
// 1. Workshop (7) - most popular (tools, fasteners, electronics)
// 2. Hobby - Maker (2) - 3D printing enthusiasts
// 3. Office (2) - USB cables, pens, clips
// 4. Kitchen (4) - common household use
// 5. Hobby - Craft (3) - paint, brush, glue
// 6. Personal (5) - key, coin, flashlight, glasses, etc.

export const INSPIRATION_LAYOUTS: InspirationLayout[] = [
  // Workshop - most popular (tools, fasteners, electronics domains heavily tracked)
  ...pickLayouts(WORKSHOP_LAYOUTS, [
    'screw-organizer',
    'hand-tools',
    'drill-bit-organizer',
    'electronics-bench',
    'battery-drawer',
    'socket-organizer',
    'garage-drawer',
  ]),
  // Hobby - Maker/3D Printing (core gridfinity user base)
  ...pickLayouts(HOBBY_LAYOUTS, [
    '3d-printing-supplies',
    'maker-station',
  ]),
  // Office (USB cables, pens, clips tracked)
  ...pickLayouts(OFFICE_LAYOUTS, [
    'cable-drawer',
    'desk-drawer',
  ]),
  // Kitchen (common household use)
  ...pickLayouts(KITCHEN_LAYOUTS, [
    'cutlery-drawer',
    'cooking-utensils',
    'knife-drawer',
    'spice-drawer',
  ]),
  // Hobby - Craft (paint, brush, glue tracked)
  ...pickLayouts(HOBBY_LAYOUTS, [
    'craft-supplies',
    'art-station',
    'sewing-kit',
  ]),
  // Personal (key, coin, flashlight, glasses, watch, medication, jewelry tracked)
  ...pickLayouts(PERSONAL_LAYOUTS, [
    'edc-drawer',
    'first-aid-kit',
    'jewelry-drawer',
    'nightstand-drawer',
    'bathroom-makeup',
  ]),
];

/**
 * Get layouts filtered by theme.
 */
export function getLayoutsByTheme(theme: InspirationTheme | 'all'): InspirationLayout[] {
  if (theme === 'all') return INSPIRATION_LAYOUTS;
  return INSPIRATION_LAYOUTS.filter((l) => l.theme === theme);
}

/**
 * Get a single layout by ID.
 */
export function getLayoutById(id: string): InspirationLayout | undefined {
  return INSPIRATION_LAYOUTS.find((l) => l.id === id);
}
