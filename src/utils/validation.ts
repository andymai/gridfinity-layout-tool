import type { Bin, Layout, ValidationResult, Rect } from '../types';
import { CONSTRAINTS, STAGING_ID } from '../constants';
import { binsCollide, getLayerZStart, getBlockedZones, isInBlockedZone } from './collision';

// ============================================================================
// Type Guards for Import Validation
// ============================================================================

interface DrawerShape {
  width: number;
  depth: number;
  height: number;
}

interface LayerShape {
  id: string;
  name: string;
  height: number;
}

interface BinShape {
  id: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  category?: string;
  label?: string;
  notes?: string;
}

interface CategoryShape {
  id: string;
  name: string;
  color: string;
}

/**
 * Type guard to check if value is a valid drawer object.
 * @param value - Unknown value to check
 * @returns True if value matches DrawerShape
 */
export function isValidDrawer(value: unknown): value is DrawerShape {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.width === 'number' &&
    typeof obj.depth === 'number' &&
    typeof obj.height === 'number'
  );
}

/**
 * Type guard to check if value is a valid layer object.
 * @param value - Unknown value to check
 * @returns True if value matches LayerShape
 */
export function isValidLayer(value: unknown): value is LayerShape {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.height === 'number'
  );
}

/**
 * Type guard to check if value is a valid bin object.
 * @param value - Unknown value to check
 * @returns True if value matches BinShape
 */
export function isValidBin(value: unknown): value is BinShape {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.layerId === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.depth === 'number' &&
    typeof obj.height === 'number'
  );
}

/**
 * Type guard to check if value is a valid category object.
 * @param value - Unknown value to check
 * @returns True if value matches CategoryShape
 */
export function isValidCategory(value: unknown): value is CategoryShape {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.color === 'string'
  );
}

/**
 * Validate if a bin can be placed at the given position.
 * @param excludeBinId - Single bin ID to exclude from collision checks
 * @param excludeBinIds - Set of bin IDs to exclude (for multi-select operations)
 */
export function canPlaceBin(
  rect: Rect & { height: number; clearanceHeight?: number },
  layerId: string,
  layout: Layout,
  excludeBinId?: string,
  excludeBinIds?: Set<string>
): ValidationResult {
  const { drawer, layers, bins } = layout;

  // Bounds check
  if (rect.x < 0 || rect.y < 0) {
    return { valid: false, reason: 'out_of_bounds' };
  }
  if (rect.x + rect.width > drawer.width) {
    return { valid: false, reason: 'exceeds_width' };
  }
  if (rect.y + rect.depth > drawer.depth) {
    return { valid: false, reason: 'exceeds_depth' };
  }

  const layer = layers.find(l => l.id === layerId);
  if (!layer) {
    return { valid: false, reason: 'invalid_layer' };
  }

  // Height check
  const zStart = getLayerZStart(layerId, layers);
  const maxHeight = drawer.height - zStart;
  if (rect.height > maxHeight) {
    return { valid: false, reason: 'exceeds_height' };
  }
  if (rect.height < layer.height) {
    // Bin must be at least as tall as its base layer
    return { valid: false, reason: 'exceeds_height' };
  }

  const blockedZones = getBlockedZones(layerId, bins, layers);
  for (let x = rect.x; x < rect.x + rect.width; x++) {
    for (let y = rect.y; y < rect.y + rect.depth; y++) {
      if (isInBlockedZone(x, y, blockedZones)) {
        return { valid: false, reason: 'blocked_zone' };
      }
    }
  }

  // Collision check with other bins
  const testBin: Bin = {
    id: excludeBinId || '__test__',
    layerId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    depth: rect.depth,
    height: rect.height,
    clearanceHeight: rect.clearanceHeight,
    category: '',
    label: '',
    notes: '',
  };

  for (const other of bins) {
    // Skip excluded bins (single ID or set of IDs)
    if (other.id === excludeBinId) continue;
    if (excludeBinIds?.has(other.id)) continue;
    if (other.layerId === STAGING_ID) continue;
    if (binsCollide(testBin, other, layers)) {
      return { valid: false, reason: 'collision' };
    }
  }

  return { valid: true };
}

/**
 * Validate an imported layout against the schema and constraints.
 */
export function validateImport(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data format'] };
  }

  const layout = data as Record<string, unknown>;

  // Required fields
  if (!layout.version) errors.push('Missing version');
  if (!layout.name) errors.push('Missing name');
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
  layers.forEach((layer, i) => {
    if (!isValidLayer(layer)) {
      errors.push(`Layer ${i} is invalid: must have id, name, and height`);
    } else {
      layerIds.add(layer.id);
    }
  });
  layerIds.add(STAGING_ID);

  // Validate each bin using type guard
  bins.forEach((bin, i) => {
    if (!isValidBin(bin)) {
      errors.push(`Bin ${i} is invalid: must have id, layerId, x, y, width, depth, height`);
      return;
    }
    if (!layerIds.has(bin.layerId)) {
      errors.push(`Bin ${i} references invalid layer: ${bin.layerId}`);
    }
    if (bin.layerId !== STAGING_ID) {
      if (bin.x < 0 || bin.y < 0 ||
          bin.x + bin.width > drawer.width ||
          bin.y + bin.depth > drawer.depth) {
        errors.push(`Bin ${i} is out of bounds`);
      }
    }
  });

  // Validate total layer height
  const validLayers = layers.filter(isValidLayer);
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

  return { valid: errors.length === 0, errors };
}

/**
 * Validate layout integrity for switching.
 * Checks that all bins reference valid layers and categories.
 * This is a lighter check than full import validation, used before switching layouts.
 */
export function validateLayoutIntegrity(layout: Layout): { valid: boolean; error?: string } {
  const layerIds = new Set(layout.layers.map(l => l.id));
  const categoryIds = new Set(layout.categories.map(c => c.id));

  for (const bin of layout.bins) {
    // Check layer reference (staging is always valid)
    if (bin.layerId !== STAGING_ID && !layerIds.has(bin.layerId)) {
      return { valid: false, error: `Bin "${bin.label || bin.id}" references missing layer` };
    }
    // Check category reference
    if (!categoryIds.has(bin.category)) {
      return { valid: false, error: `Bin "${bin.label || bin.id}" references missing category` };
    }
  }

  // Check we have at least one layer and category
  if (layout.layers.length === 0) {
    return { valid: false, error: 'Layout has no layers' };
  }
  if (layout.categories.length === 0) {
    return { valid: false, error: 'Layout has no categories' };
  }

  return { valid: true };
}

/**
 * Clamp a value to a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Truncate a string to max length.
 */
export function truncate(str: string, maxLength: number): string {
  return str.slice(0, maxLength);
}
