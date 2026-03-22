/**
 * Feature color types for multi-color 3MF export.
 *
 * Maps bin features to filament slots from the user's global palette,
 * enabling per-feature color assignment for multi-material printing.
 */

import { FeatureTag } from '@/shared/types/generation';

// Re-export filament types from shared (canonical location for cross-layer imports)
export type { FilamentSlotId, FilamentSlot } from '@/shared/types/filament';
import type { FilamentSlotId, FilamentSlot } from '@/shared/types/filament';

/** High-level color zone grouping multiple FeatureTags */
export type ColorZone = 'body' | 'lip' | 'labelTab';

/** Per-feature filament assignment: maps each color zone to a filament slot */
export interface FeatureColorConfig {
  readonly body: FilamentSlotId;
  readonly lip: FilamentSlotId;
  readonly labelTab: FilamentSlotId;
}

/**
 * Maps a FeatureTag to its high-level ColorZone.
 *
 * LIP → 'lip', LABEL_TAB → 'labelTab', everything else → 'body'.
 * This collapses 12 feature tags into 3 user-facing zones.
 */
export function featureTagToColorZone(tag: number): ColorZone {
  switch (tag) {
    case FeatureTag.LIP:
      return 'lip';
    case FeatureTag.LABEL_TAB:
      return 'labelTab';
    default:
      return 'body';
  }
}

/** Resolved slot mapping: deduplicated slot list with index lookup */
export interface SlotMapping<T> {
  /** Ordered list of resolved values (one per unique slot) */
  readonly items: readonly T[];
  /** Maps each FilamentSlotId to its index in `items` */
  readonly slotToIndex: ReadonlyMap<FilamentSlotId, number>;
  /** Index for untagged/body triangles */
  readonly defaultIndex: number;
}

/**
 * Returns true when all color zones map to the same filament slot
 * (single-color — no multi-material needed).
 */
export function isSingleColor(featureColors: FeatureColorConfig): boolean {
  return featureColors.body === featureColors.lip && featureColors.body === featureColors.labelTab;
}

/**
 * Deduplicates active filament slots and builds an index mapping.
 *
 * Shared by both the 3MF exporter (materialMapping) and the 3D preview (BinMesh).
 * The `resolve` callback transforms each FilamentSlot into the desired output type
 * (e.g., `{ name, color }` for 3MF, or just the color string for preview).
 */
export function resolveSlotMapping<T>(
  featureColors: FeatureColorConfig,
  palette: readonly FilamentSlot[],
  resolve: (slot: FilamentSlot) => T
): SlotMapping<T> {
  // Insert body slot first to guarantee it's at index 0 (safe fallback)
  const slotToIndex = new Map<FilamentSlotId, number>();
  const items: T[] = [];

  const bodySlot = palette.find((s) => s.id === featureColors.body);
  if (bodySlot) {
    slotToIndex.set(featureColors.body, 0);
    items.push(resolve(bodySlot));
  }

  // Add remaining unique slots
  for (const slotId of [featureColors.lip, featureColors.labelTab]) {
    if (slotToIndex.has(slotId)) continue;
    const slot = palette.find((s) => s.id === slotId);
    if (slot) {
      slotToIndex.set(slotId, items.length);
      items.push(resolve(slot));
    }
  }

  const defaultIndex = slotToIndex.get(featureColors.body) ?? 0;
  return { items, slotToIndex, defaultIndex };
}
