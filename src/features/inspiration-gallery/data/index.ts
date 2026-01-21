import type { InspirationLayout, InspirationTheme } from '../types';
import {
  KITCHEN_LAYOUTS,
  WORKSHOP_LAYOUTS,
  OFFICE_LAYOUTS,
  HOBBY_LAYOUTS,
  PERSONAL_LAYOUTS,
} from './themes';

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
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'screw-organizer'),
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'tool-drawer'),
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'drill-bit-organizer'),
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'electronics-bench'),
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'battery-drawer'),
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'socket-organizer'),
  ...WORKSHOP_LAYOUTS.filter((l) => l.id === 'garage-drawer'),
  // Hobby - Maker/3D Printing (core gridfinity user base)
  ...HOBBY_LAYOUTS.filter((l) => l.id === '3d-printing-supplies'),
  ...HOBBY_LAYOUTS.filter((l) => l.id === 'maker-station'),
  // Office (USB cables, pens, clips tracked)
  ...OFFICE_LAYOUTS.filter((l) => l.id === 'cable-drawer'),
  ...OFFICE_LAYOUTS.filter((l) => l.id === 'desk-drawer'),
  // Kitchen (common household use)
  ...KITCHEN_LAYOUTS.filter((l) => l.id === 'cutlery-drawer'),
  ...KITCHEN_LAYOUTS.filter((l) => l.id === 'cooking-utensils'),
  ...KITCHEN_LAYOUTS.filter((l) => l.id === 'knife-drawer'),
  ...KITCHEN_LAYOUTS.filter((l) => l.id === 'spice-drawer'),
  // Hobby - Craft (paint, brush, glue tracked)
  ...HOBBY_LAYOUTS.filter((l) => l.id === 'craft-supplies'),
  ...HOBBY_LAYOUTS.filter((l) => l.id === 'art-station'),
  ...HOBBY_LAYOUTS.filter((l) => l.id === 'sewing-kit'),
  // Personal (key, coin, flashlight, glasses, watch, medication, jewelry tracked)
  ...PERSONAL_LAYOUTS.filter((l) => l.id === 'edc-drawer'),
  ...PERSONAL_LAYOUTS.filter((l) => l.id === 'first-aid-kit'),
  ...PERSONAL_LAYOUTS.filter((l) => l.id === 'jewelry-drawer'),
  ...PERSONAL_LAYOUTS.filter((l) => l.id === 'nightstand-drawer'),
  ...PERSONAL_LAYOUTS.filter((l) => l.id === 'bathroom-makeup'),
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
