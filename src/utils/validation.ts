import type { Bin, Layout, ValidationResult, Rect } from '../types';
import { CONSTRAINTS, STAGING_ID } from '../constants';
import { binsCollide, getLayerZStart, getBlockedZones, isInBlockedZone } from './collision';

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
  if (!layout.drawer) errors.push('Missing drawer');
  if (!Array.isArray(layout.layers)) errors.push('Invalid layers');
  if (!Array.isArray(layout.bins)) errors.push('Invalid bins');
  if (!Array.isArray(layout.categories)) errors.push('Invalid categories');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const drawer = layout.drawer as Record<string, unknown>;
  const layers = layout.layers as unknown[];
  const bins = layout.bins as unknown[];
  const categories = layout.categories as unknown[];

  // Drawer constraints
  if (typeof drawer.width !== 'number' || drawer.width < CONSTRAINTS.GRID_MIN || drawer.width > CONSTRAINTS.GRID_MAX) {
    errors.push(`Drawer width must be ${CONSTRAINTS.GRID_MIN}-${CONSTRAINTS.GRID_MAX}`);
  }
  if (typeof drawer.depth !== 'number' || drawer.depth < CONSTRAINTS.GRID_MIN || drawer.depth > CONSTRAINTS.GRID_MAX) {
    errors.push(`Drawer depth must be ${CONSTRAINTS.GRID_MIN}-${CONSTRAINTS.GRID_MAX}`);
  }

  // Layer constraints
  if (layers.length < CONSTRAINTS.LAYERS_MIN || layers.length > CONSTRAINTS.LAYERS_MAX) {
    errors.push(`Must have ${CONSTRAINTS.LAYERS_MIN}-${CONSTRAINTS.LAYERS_MAX} layers`);
  }

  // Validate layer references
  const layerIds = new Set(layers.map((l: unknown) => (l as { id: string }).id));
  layerIds.add(STAGING_ID);

  // Validate bins
  bins.forEach((bin: unknown, i) => {
    const b = bin as { layerId: string; x: number; y: number; width: number; depth: number };
    if (!layerIds.has(b.layerId)) {
      errors.push(`Bin ${i} references invalid layer: ${b.layerId}`);
    }
    if (b.layerId !== STAGING_ID) {
      if (b.x < 0 || b.y < 0 ||
          b.x + b.width > (drawer.width as number) ||
          b.y + b.depth > (drawer.depth as number)) {
        errors.push(`Bin ${i} is out of bounds`);
      }
    }
  });

  // Validate total layer height
  const totalHeight = layers.reduce((sum: number, l: unknown) => sum + ((l as { height: number }).height || 0), 0);
  if (totalHeight > (drawer.height as number)) {
    errors.push('Total layer height exceeds drawer height');
  }

  // Validate category uniqueness
  const categoryNames = new Set<string>();
  categories.forEach((cat: unknown) => {
    const c = cat as { name: string };
    const name = (c.name || '').toLowerCase();
    if (categoryNames.has(name)) {
      errors.push(`Duplicate category name: ${c.name}`);
    }
    categoryNames.add(name);
  });

  return { valid: errors.length === 0, errors };
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
