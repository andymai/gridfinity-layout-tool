/**
 * Server-side validation for cloud sharing.
 * Adapted from client-side validation but with stricter limits.
 */

import { isNumber, isObject, inRange, validationError } from './validationUtils.js';

// Constraints for shared layouts
const SHARE_CONSTRAINTS = {
  MAX_SIZE_BYTES: 500 * 1024, // 500KB
  MAX_BINS: 2500,
  GRID_MIN: 1,
  GRID_MAX: 50,
  LAYERS_MIN: 1,
  LAYERS_MAX: 10,
  CATEGORIES_MAX: 20,
  NAME_MAX_LENGTH: 64,
  LABEL_MAX_LENGTH: 24,
  NOTES_MAX_LENGTH: 256,
  VALID_EXPIRATIONS: [30, 60, 90, 365] as const,
  // Custom properties constraints
  CUSTOM_PROPERTY_MAX_COUNT: 50,
  CUSTOM_PROPERTY_KEY_MAX_LENGTH: 32,
  CUSTOM_PROPERTY_VALUE_MAX_LENGTH: 256,
  CUSTOM_PROPERTY_MAX_TOTAL_SIZE: 20480, // 20KB total per bin
};

/** Reserved keys that cannot be used as custom property names */
const RESERVED_PROPERTY_KEYS = [
  'id',
  'layerId',
  'x',
  'y',
  'width',
  'depth',
  'height',
  'clearanceHeight',
  'category',
  'label',
  'notes',
  'customProperties',
  // Prevent prototype pollution
  '__proto__',
  'constructor',
  'prototype',
];

export type ValidExpiration = (typeof SHARE_CONSTRAINTS.VALID_EXPIRATIONS)[number];

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
  // Required (empty when absent) to match the local `Bin` invariant; the 3D
  // view crashes on `bin.notes.trim()` if these arrive as undefined.
  label: string;
  notes: string;
  customProperties?: Record<string, string>;
}

interface CategoryShape {
  id: string;
  name: string;
  color: string;
}

interface LayoutShape {
  version: string;
  name: string;
  drawer: DrawerShape;
  layers: LayerShape[];
  bins: BinShape[];
  categories: CategoryShape[];
  printBedSize?: number;
  printBedDepth?: number;
  gridUnitMm?: number;
  heightUnitMm?: number;
}

export interface ValidationError {
  code: 'VALIDATION_ERROR' | 'SIZE_LIMIT' | 'BIN_LIMIT' | 'INVALID_EXPIRATION';
  message: string;
}

export type ValidationResult =
  | { valid: true; layout: LayoutShape }
  | { valid: false; error: ValidationError };

/**
 * Type guard for validation failure.
 * Helps TypeScript narrow the type in environments where control flow analysis is limited.
 */
export function isValidationError(
  result: ValidationResult
): result is { valid: false; error: ValidationError } {
  return !result.valid;
}

/**
 * Validate a layout for cloud sharing.
 * Returns sanitized layout on success.
 */
export function validateShareLayout(data: unknown, jsonSize: number): ValidationResult {
  // Size check first
  if (jsonSize > SHARE_CONSTRAINTS.MAX_SIZE_BYTES) {
    return validationError(
      'SIZE_LIMIT',
      `Layout exceeds maximum size of ${SHARE_CONSTRAINTS.MAX_SIZE_BYTES / 1024}KB`
    );
  }

  if (!isObject(data)) {
    return validationError('VALIDATION_ERROR', 'Invalid layout format');
  }

  const layout = data;

  // Check required fields
  const requiredErrors: string[] = [];
  if (!layout.version || typeof layout.version !== 'string') {
    requiredErrors.push('missing version');
  }
  if (!layout.name || typeof layout.name !== 'string') {
    requiredErrors.push('missing name');
  }
  if (!isValidDrawer(layout.drawer)) {
    requiredErrors.push('invalid drawer');
  }
  if (!Array.isArray(layout.layers)) {
    requiredErrors.push('invalid layers');
  }
  if (!Array.isArray(layout.bins)) {
    requiredErrors.push('invalid bins');
  }
  if (!Array.isArray(layout.categories)) {
    requiredErrors.push('invalid categories');
  }

  if (requiredErrors.length > 0) {
    return validationError('VALIDATION_ERROR', `Invalid layout: ${requiredErrors.join(', ')}`);
  }

  const drawer = layout.drawer as DrawerShape;
  const layers = layout.layers as unknown[];
  const bins = layout.bins as unknown[];
  const categories = layout.categories as unknown[];

  // Bin count check
  if (bins.length > SHARE_CONSTRAINTS.MAX_BINS) {
    return validationError(
      'BIN_LIMIT',
      `Layout exceeds maximum of ${SHARE_CONSTRAINTS.MAX_BINS} bins`
    );
  }

  // Validate drawer dimensions
  if (
    !inRange(drawer.width, SHARE_CONSTRAINTS.GRID_MIN, SHARE_CONSTRAINTS.GRID_MAX) ||
    !inRange(drawer.depth, SHARE_CONSTRAINTS.GRID_MIN, SHARE_CONSTRAINTS.GRID_MAX)
  ) {
    return validationError(
      'VALIDATION_ERROR',
      `Drawer dimensions must be ${SHARE_CONSTRAINTS.GRID_MIN}-${SHARE_CONSTRAINTS.GRID_MAX}`
    );
  }

  // Validate layer count
  if (!inRange(layers.length, SHARE_CONSTRAINTS.LAYERS_MIN, SHARE_CONSTRAINTS.LAYERS_MAX)) {
    return validationError(
      'VALIDATION_ERROR',
      `Must have ${SHARE_CONSTRAINTS.LAYERS_MIN}-${SHARE_CONSTRAINTS.LAYERS_MAX} layers`
    );
  }

  // Validate category count
  if (categories.length > SHARE_CONSTRAINTS.CATEGORIES_MAX) {
    return validationError(
      'VALIDATION_ERROR',
      `Maximum ${SHARE_CONSTRAINTS.CATEGORIES_MAX} categories allowed`
    );
  }

  // Validate each layer
  const validatedLayers: LayerShape[] = [];
  for (const layer of layers) {
    if (!isValidLayer(layer)) {
      return validationError('VALIDATION_ERROR', 'Invalid layer structure');
    }
    validatedLayers.push({
      id: sanitizeString(layer.id, 64),
      name: sanitizeString(layer.name, SHARE_CONSTRAINTS.LABEL_MAX_LENGTH),
      height: layer.height,
    });
  }

  // Validate each bin
  const validatedBins: BinShape[] = [];
  for (const bin of bins) {
    if (!isValidBin(bin)) {
      return validationError('VALIDATION_ERROR', 'Invalid bin structure');
    }

    // Validate and sanitize custom properties if present
    let validatedCustomProperties: Record<string, string> | undefined;
    if (
      bin.customProperties &&
      typeof bin.customProperties === 'object' &&
      !Array.isArray(bin.customProperties)
    ) {
      const props = bin.customProperties as Record<string, unknown>;
      const keys = Object.keys(props);

      // Check property count
      if (keys.length > SHARE_CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT) {
        return validationError(
          'VALIDATION_ERROR',
          `Bin has too many custom properties (max ${SHARE_CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT})`
        );
      }

      // Validate and sanitize each property
      const sanitized: Record<string, string> = {};
      let totalSize = 0;

      for (const key of keys) {
        const value = props[key];

        // Skip non-string values
        if (typeof value !== 'string') continue;

        // Sanitize key and value
        const cleanKey = sanitizeString(key, SHARE_CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH);
        const cleanValue = sanitizeString(
          value,
          SHARE_CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH
        );

        // Skip empty keys
        if (!cleanKey) continue;

        // Skip reserved keys
        if (RESERVED_PROPERTY_KEYS.includes(cleanKey)) continue;

        totalSize += cleanKey.length + cleanValue.length;

        // Check total size limit
        if (totalSize > SHARE_CONSTRAINTS.CUSTOM_PROPERTY_MAX_TOTAL_SIZE) {
          return validationError(
            'VALIDATION_ERROR',
            `Bin custom properties exceed size limit (max ${SHARE_CONSTRAINTS.CUSTOM_PROPERTY_MAX_TOTAL_SIZE / 1024}KB)`
          );
        }

        sanitized[cleanKey] = cleanValue;
      }

      if (Object.keys(sanitized).length > 0) {
        validatedCustomProperties = sanitized;
      }
    }

    validatedBins.push({
      id: sanitizeString(bin.id, 64),
      layerId: sanitizeString(bin.layerId, 64),
      x: bin.x,
      y: bin.y,
      width: bin.width,
      depth: bin.depth,
      height: bin.height,
      category: bin.category ? sanitizeString(bin.category, 64) : undefined,
      label: bin.label ? sanitizeString(bin.label, SHARE_CONSTRAINTS.LABEL_MAX_LENGTH) : '',
      notes: bin.notes ? sanitizeString(bin.notes, SHARE_CONSTRAINTS.NOTES_MAX_LENGTH) : '',
      customProperties: validatedCustomProperties,
    });
  }

  // Validate each category
  const validatedCategories: CategoryShape[] = [];
  for (const cat of categories) {
    if (!isValidCategory(cat)) {
      return validationError('VALIDATION_ERROR', 'Invalid category structure');
    }
    validatedCategories.push({
      id: sanitizeString(cat.id, 64),
      name: sanitizeString(cat.name, SHARE_CONSTRAINTS.LABEL_MAX_LENGTH),
      color: sanitizeColor(cat.color),
    });
  }

  // Return sanitized layout
  return {
    valid: true,
    layout: {
      version: sanitizeString(String(layout.version), 10),
      name: sanitizeString(String(layout.name), SHARE_CONSTRAINTS.NAME_MAX_LENGTH),
      drawer,
      layers: validatedLayers,
      bins: validatedBins,
      categories: validatedCategories,
      printBedSize: isNumber(layout.printBedSize) ? layout.printBedSize : undefined,
      printBedDepth: isNumber(layout.printBedDepth) ? layout.printBedDepth : undefined,
      gridUnitMm: isNumber(layout.gridUnitMm) ? layout.gridUnitMm : undefined,
      heightUnitMm: isNumber(layout.heightUnitMm) ? layout.heightUnitMm : undefined,
    },
  };
}

/**
 * Validate expiration days parameter.
 */
export function validateExpiration(days: unknown): days is ValidExpiration {
  return (
    typeof days === 'number' &&
    SHARE_CONSTRAINTS.VALID_EXPIRATIONS.includes(days as ValidExpiration)
  );
}

// Type guards
function isValidDrawer(value: unknown): value is DrawerShape {
  if (!isObject(value)) return false;
  return (
    isNumber(value.width) &&
    isNumber(value.depth) &&
    isNumber(value.height) &&
    value.width > 0 &&
    value.depth > 0 &&
    value.height > 0
  );
}

function isValidLayer(value: unknown): value is LayerShape {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNumber(value.height) &&
    value.height > 0
  );
}

function isValidBin(value: unknown): value is BinShape {
  if (!isObject(value)) return false;
  // `category`/`label`/`notes` must be string-or-absent before they reach
  // `sanitizeString`, which calls `.replace` and throws on non-strings.
  const optString = (v: unknown): boolean => v === undefined || typeof v === 'string';
  return (
    typeof value.id === 'string' &&
    typeof value.layerId === 'string' &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.depth) &&
    isNumber(value.height) &&
    value.width > 0 &&
    value.depth > 0 &&
    value.height > 0 &&
    optString(value.category) &&
    optString(value.label) &&
    optString(value.notes)
  );
}

function isValidCategory(value: unknown): value is CategoryShape {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string'
  );
}

function sanitizeString(str: string, maxLength: number): string {
  // Remove null bytes and control characters, trim, truncate
  return (
    str
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim()
      .slice(0, maxLength)
  );
}

function sanitizeColor(color: string): string {
  // Ensure valid hex color format
  const match = color.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  if (match) {
    let hex = match[1].toLowerCase();
    // Expand 3-char to 6-char (#abc -> #aabbcc)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return '#' + hex;
  }
  return '#888888'; // Default gray for invalid colors
}

// Export constraints for use in other modules
export { SHARE_CONSTRAINTS };
