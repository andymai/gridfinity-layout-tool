import type { Bin, Layout, ValidationResult, Rect, OperationResult } from '../../core/types';
import { CONSTRAINTS, STAGING_ID, RESERVED_PROPERTY_KEYS } from '../../core/constants';
import { binsCollide, getLayerZStart, getBlockedZones, isInBlockedZone } from '../../utils/collision';
import type { Result, ValidationError } from '../../core/result';
import {
  ok,
  err,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
  validationHeightExceeded,
  validationBlockedZone,
  validationImportFailed,
} from '../../core/result';

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
  customProperties?: Record<string, string>;
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

  // Height check - only validate max height (bin can't exceed drawer)
  // Layer height is a default for new bins, not a constraint for existing bins
  const zStart = getLayerZStart(layerId, layers);
  const maxHeight = drawer.height - zStart;
  if (rect.height > maxHeight) {
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
 * Validate if a bin can be placed at the given position.
 * Returns a Result type with rich error information.
 *
 * @param rect - The rectangle to place (x, y, width, depth, height)
 * @param layerId - The layer to place the bin on
 * @param layout - The current layout state
 * @param excludeBinId - Single bin ID to exclude from collision checks
 * @param excludeBinIds - Set of bin IDs to exclude (for multi-select operations)
 * @returns Result<void, ValidationError> with specific error type on failure
 */
export function canPlaceBinResult(
  rect: Rect & { height: number; clearanceHeight?: number },
  layerId: string,
  layout: Layout,
  excludeBinId?: string,
  excludeBinIds?: Set<string>
): Result<void, ValidationError> {
  const { drawer, layers, bins } = layout;
  const binData = { x: rect.x, y: rect.y, width: rect.width, depth: rect.depth };

  // Bounds check
  if (rect.x < 0 || rect.y < 0) {
    return err(validationOutOfBounds('out_of_bounds', binData));
  }
  if (rect.x + rect.width > drawer.width) {
    return err(validationOutOfBounds('exceeds_width', binData));
  }
  if (rect.y + rect.depth > drawer.depth) {
    return err(validationOutOfBounds('exceeds_depth', binData));
  }

  const layer = layers.find(l => l.id === layerId);
  if (!layer) {
    return err(validationInvalidLayer(layerId));
  }

  // Height check - only validate max height (bin can't exceed drawer)
  // Layer height is a default for new bins, not a constraint for existing bins
  const zStart = getLayerZStart(layerId, layers);
  const maxHeight = drawer.height - zStart;
  if (rect.height > maxHeight) {
    return err(validationHeightExceeded(rect.height, maxHeight));
  }

  // Blocked zone check
  const blockedZones = getBlockedZones(layerId, bins, layers);
  for (let x = rect.x; x < rect.x + rect.width; x++) {
    for (let y = rect.y; y < rect.y + rect.depth; y++) {
      if (isInBlockedZone(x, y, blockedZones)) {
        return err(validationBlockedZone());
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

  const collidingBinIds: string[] = [];
  for (const other of bins) {
    // Skip excluded bins (single ID or set of IDs)
    if (other.id === excludeBinId) continue;
    if (excludeBinIds?.has(other.id)) continue;
    if (other.layerId === STAGING_ID) continue;
    if (binsCollide(testBin, other, layers)) {
      collidingBinIds.push(other.id);
    }
  }

  if (collidingBinIds.length > 0) {
    return err(validationCollision(collidingBinIds));
  }

  return ok(undefined);
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
        drawer: drawer as Layout['drawer'],
        layers: validLayers as Layout['layers'],
        bins: validatedBins,
        categories: [] as Layout['categories'],
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
      };

      const placementResult = canPlaceBin(
        { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
        bin.layerId,
        partialLayout
      );

      if (!placementResult.valid) {
        const reasonMap: Record<string, string> = {
          out_of_bounds: 'is out of bounds',
          exceeds_width: 'exceeds drawer width',
          exceeds_depth: 'exceeds drawer depth',
          exceeds_height: 'exceeds available height',
          invalid_layer: 'references invalid layer',
          blocked_zone: 'overlaps with blocked zone from upper layer',
          collision: 'collides with another bin',
        };
        const message = reasonMap[placementResult.reason || ''] || 'has invalid placement';
        errors.push(`Bin ${i} ${message}`);
      }
    }

    // Add to validated bins for subsequent collision checks
    validatedBins.push({
      id: bin.id,
      layerId: bin.layerId,
      x: bin.x,
      y: bin.y,
      width: bin.width,
      depth: bin.depth,
      height: bin.height,
      category: bin.category || '',
      label: bin.label || '',
      notes: bin.notes || '',
      customProperties: bin.customProperties,
    });

    // Validate custom properties if present
    if (bin.customProperties) {
      const result = validateCustomProperties(bin.customProperties);
      if (!result.success) {
        errors.push(`Bin ${i}: ${result.error}`);
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

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an imported layout against the schema and constraints.
 * Returns a Result type with structured error information.
 *
 * @param data - Unknown data to validate as a layout
 * @returns Result<void, ValidationError> with VALIDATION_IMPORT_FAILED on failure
 */
export function validateImportResult(data: unknown): Result<void, ValidationError> {
  const result = validateImport(data);
  if (result.valid) {
    return ok(undefined);
  }
  return err(validationImportFailed(result.errors));
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
    // Check category reference (category is optional, only validate if present)
    if (bin.category && !categoryIds.has(bin.category)) {
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
 * Validate layout integrity for switching.
 * Returns a Result type with structured error information.
 *
 * @param layout - Layout to validate
 * @returns Result<void, ValidationError> with VALIDATION_IMPORT_FAILED on failure
 */
export function validateLayoutIntegrityResult(layout: Layout): Result<void, ValidationError> {
  const result = validateLayoutIntegrity(layout);
  if (result.valid) {
    return ok(undefined);
  }
  return err(validationImportFailed([result.error || 'Unknown validation error']));
}

/**
 * Validate custom properties for a bin.
 * Checks property count, key/value lengths, and reserved keys.
 *
 * @param props - Custom properties object to validate
 * @returns OperationResult with success status and error message if invalid
 */
export function validateCustomProperties(props: Record<string, string>): OperationResult {
  if (!props) {
    return { success: true }; // undefined/null is valid (no custom properties)
  }

  if (typeof props !== 'object' || Array.isArray(props)) {
    return {
      success: false,
      error: 'Custom properties must be provided as a plain object',
    };
  }

  const keys = Object.keys(props);

  // Check property count
  if (keys.length > CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT) {
    return {
      success: false,
      error: `Maximum ${CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT} custom properties allowed per bin`,
    };
  }

  // Validate each property
  for (const key of keys) {
    // Check key is not empty
    if (!key.trim()) {
      return { success: false, error: 'Custom property key cannot be empty' };
    }

    // Check key length
    if (key.length > CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH) {
      return {
        success: false,
        error: `Custom property key "${key}" exceeds maximum length of ${CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH} characters`,
      };
    }

    // Check reserved keys
    if (RESERVED_PROPERTY_KEYS.includes(key as typeof RESERVED_PROPERTY_KEYS[number])) {
      return {
        success: false,
        error: `"${key}" is a reserved field name and cannot be used as a custom property`,
      };
    }

    // Check value type
    const value = props[key];
    if (typeof value !== 'string') {
      return {
        success: false,
        error: `Custom property value for "${key}" must be a string`,
      };
    }

    // Check value length
    if (value.length > CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH) {
      return {
        success: false,
        error: `Custom property value for "${key}" exceeds maximum length of ${CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH} characters`,
      };
    }
  }

  return { success: true };
}

/**
 * Validate custom properties for a bin.
 * Returns a Result type with structured error information.
 *
 * @param props - Custom properties object to validate
 * @returns Result<void, ValidationError> with VALIDATION_IMPORT_FAILED on failure
 */
export function validateCustomPropertiesResult(props: Record<string, string>): Result<void, ValidationError> {
  const result = validateCustomProperties(props);
  if (result.success) {
    return ok(undefined);
  }
  return err(validationImportFailed([result.error ?? 'Invalid custom properties']));
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
