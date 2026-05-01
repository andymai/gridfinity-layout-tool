/**
 * Strict import validation for layouts.
 *
 * Rejects the entire layout if any bin is structurally invalid, references
 * a missing layer, or fails placement (bounds, height, collision, blocked
 * zones). Use `salvageImport` from `validationSalvage` when you'd rather
 * move problematic bins to staging instead of rejecting the whole document.
 *
 * The `PLACEMENT_REASON_MESSAGE` map is shared with `validationSalvage` so
 * both pathways speak with the same vocabulary.
 */

import type { Bin, Layout, ValidationReason } from '@/core/types';
import {
  binId as toBinId,
  layerId as toLayerId,
  categoryId as toCategoryId,
  mm,
  gridUnits,
  heightUnits,
} from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { isOk } from '@/core/result';
import {
  isValidDrawer,
  isValidLayer,
  isValidBin,
  isValidCategory,
  type DrawerShape,
} from './validationGuards';
import { canPlaceBin } from './validationPlacement';
import { validateCustomProperties } from './validationProperties';

/** Human-readable suffixes for placement failure reasons. */
export const PLACEMENT_REASON_MESSAGE: Record<ValidationReason, string> = {
  out_of_bounds: 'is out of bounds',
  exceeds_width: 'exceeds drawer width',
  exceeds_depth: 'exceeds drawer depth',
  exceeds_height: 'exceeds available height',
  invalid_layer: 'references invalid layer',
  blocked_zone: 'overlaps with blocked zone from upper layer',
  collision: 'collides with another bin',
};

export type ValidationSuccess = { valid: true; errors: readonly []; layout: Layout };
export type ValidationFailure = { valid: false; errors: string[] };
export type ImportValidationResult = ValidationSuccess | ValidationFailure;

export function validateImport(data: unknown): ImportValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data format'] };
  }

  const layout = data as Record<string, unknown>;

  // Required fields — version/name must be non-empty strings, not just truthy,
  // so downstream display code can safely call string methods.
  if (layout.version === undefined || layout.version === null) {
    errors.push('Missing version');
  } else if (typeof layout.version !== 'string' || layout.version.trim().length === 0) {
    errors.push('Invalid version: must be a non-empty string');
  }
  if (layout.name === undefined || layout.name === null) {
    errors.push('Missing name');
  } else if (typeof layout.name !== 'string' || layout.name.trim().length === 0) {
    errors.push('Invalid name: must be a non-empty string');
  }
  if (!Array.isArray(layout.layers)) errors.push('Invalid layers');
  if (!Array.isArray(layout.bins)) errors.push('Invalid bins');
  if (!Array.isArray(layout.categories)) errors.push('Invalid categories');

  // Validate drawer using type guard
  if (!isValidDrawer(layout.drawer)) {
    errors.push('Invalid drawer: must have width, depth, and height as numbers');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // After validation, we can safely access these
  const drawer = layout.drawer as DrawerShape;
  const layers = layout.layers as unknown[];
  const bins = layout.bins as unknown[];
  const categories = layout.categories as unknown[];

  // Drawer constraints
  if (drawer.width < CONSTRAINTS.GRID_MIN || drawer.width > CONSTRAINTS.GRID_MAX) {
    errors.push(`Drawer width must be ${CONSTRAINTS.GRID_MIN}-${CONSTRAINTS.GRID_MAX}`);
  }
  if (drawer.depth < CONSTRAINTS.GRID_MIN || drawer.depth > CONSTRAINTS.GRID_MAX) {
    errors.push(`Drawer depth must be ${CONSTRAINTS.GRID_MIN}-${CONSTRAINTS.GRID_MAX}`);
  }

  // Layer constraints
  if (layers.length < CONSTRAINTS.LAYERS_MIN || layers.length > CONSTRAINTS.LAYERS_MAX) {
    errors.push(`Must have ${CONSTRAINTS.LAYERS_MIN}-${CONSTRAINTS.LAYERS_MAX} layers`);
  }

  // Validate each layer using type guard and collect IDs
  const layerIds = new Set<string>();
  const validLayers = layers.filter(isValidLayer);
  layers.forEach((layer, i) => {
    if (!isValidLayer(layer)) {
      errors.push(`Layer ${i} is invalid: must have id, name, and height`);
    } else {
      layerIds.add(layer.id);
    }
  });
  layerIds.add(STAGING_ID);

  // Validate each bin using type guard
  // First pass: validate structure and collect valid bins
  const validatedBins: Bin[] = [];
  bins.forEach((bin, i) => {
    if (!isValidBin(bin)) {
      errors.push(`Bin ${i} is invalid: must have id, layerId, x, y, width, depth, height`);
      return;
    }
    if (!layerIds.has(bin.layerId)) {
      errors.push(`Bin ${i} references invalid layer: ${bin.layerId}`);
      return;
    }

    // For non-staging bins, use canPlaceBin for full validation
    // (bounds, height, collisions, blocked zones)
    if (bin.layerId !== STAGING_ID) {
      // Build partial layout with already-validated bins for collision checking
      const partialLayout: Layout = {
        version: '1.0',
        name: 'import-validation',
        drawer: {
          width: gridUnits(drawer.width),
          depth: gridUnits(drawer.depth),
          height: heightUnits(drawer.height),
        },
        layers: validLayers.map((l) => ({
          ...l,
          height: heightUnits((l as { height: number }).height),
        })) as Layout['layers'],
        bins: validatedBins,
        categories: [] as Layout['categories'],
        printBedSize: mm(256),
        gridUnitMm: mm(42),
        heightUnitMm: mm(7),
      };

      const placementResult = canPlaceBin(
        {
          x: gridUnits(bin.x),
          y: gridUnits(bin.y),
          width: gridUnits(bin.width),
          depth: gridUnits(bin.depth),
          height: heightUnits(bin.height),
        },
        toLayerId(bin.layerId),
        partialLayout
      );

      if (!placementResult.valid) {
        const message = PLACEMENT_REASON_MESSAGE[placementResult.reason] || 'has invalid placement';
        errors.push(`Bin ${i} ${message}`);
        return; // Don't add invalid bins to collision pool for subsequent checks
      }
    }

    // Add to validated bins for subsequent collision checks
    validatedBins.push({
      id: toBinId(bin.id),
      layerId: toLayerId(bin.layerId),
      x: gridUnits(bin.x),
      y: gridUnits(bin.y),
      width: gridUnits(bin.width),
      depth: gridUnits(bin.depth),
      height: heightUnits(bin.height),
      category: toCategoryId(bin.category || ''),
      label: bin.label || '',
      notes: bin.notes || '',
      customProperties: bin.customProperties,
    });

    // Validate custom properties if present
    if (bin.customProperties) {
      const propsResult = validateCustomProperties(bin.customProperties);
      if (!isOk(propsResult)) {
        const errObj = propsResult.error;
        const detail =
          errObj.code === 'VALIDATION_IMPORT_FAILED'
            ? errObj.errors[0] || errObj.message
            : errObj.message;
        errors.push(`Bin ${i}: ${detail}`);
      }
    }
  });

  // Validate total layer height
  const totalHeight = validLayers.reduce((sum, layer) => sum + layer.height, 0);
  if (totalHeight > drawer.height) {
    errors.push('Total layer height exceeds drawer height');
  }

  // Validate each category using type guard and check uniqueness
  const categoryNames = new Set<string>();
  categories.forEach((cat, i) => {
    if (!isValidCategory(cat)) {
      errors.push(`Category ${i} is invalid: must have id, name, and color`);
      return;
    }
    const name = cat.name.toLowerCase();
    if (categoryNames.has(name)) {
      errors.push(`Duplicate category name: ${cat.name}`);
    }
    categoryNames.add(name);
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], layout: data as Layout };
}
