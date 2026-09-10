/**
 * Server-side validation for cloud sharing.
 * Adapted from client-side validation but with stricter limits.
 */

import { sanitizeString } from './sanitize.js';
export { sanitizeString } from './sanitize.js';
import { isNumber, isObject, inRange, validationError } from './validationUtils.js';
import { isValidDrawer, sanitizeDrawer } from './drawerValidation.js';
import type { DrawerShape } from './drawerValidation.js';
import { DESIGN_ID_MAX_LENGTH, RESERVED_PROPERTY_KEYS } from './sharedDesignsValidation.js';
import { SHARE_CONSTRAINTS } from './shareConstraints.js';
import type { ValidExpiration, ValidationError } from './shareConstraints.js';
export { SHARE_CONSTRAINTS } from './shareConstraints.js';
export type { ValidExpiration, ValidationError } from './shareConstraints.js';
export {
  DESIGN_ID_MAX_LENGTH,
  RESERVED_PROPERTY_KEYS,
  validateSharedDesigns,
  isSharedDesignsError,
} from './sharedDesignsValidation.js';
export type { SharedDesignShape, SharedDesignsResult } from './sharedDesignsValidation.js';
export { isValidDrawer, sanitizeDrawer } from './drawerValidation.js';
export type { DrawerShape } from './drawerValidation.js';

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
  linkedDesignId?: string;
  locked?: boolean;
  pairId?: string;
  pairRole?: 'block' | 'rest';
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
  gridUnitMmY?: number;
  heightUnitMm?: number;
  magnetAnchor?: 'edge' | 'center';
  /** Library folder, carried for cloud sync only; shares strip it. */
  folderId?: string;
}

const FOLDER_ID_PATTERN = /^folder_\d+_[a-z0-9]{1,8}$/;

export function isValidFolderId(value: unknown): value is string {
  return typeof value === 'string' && FOLDER_ID_PATTERN.test(value);
}

/** A share is public; the owner's library placement stays home. */
export function withoutLibraryPlacement<T extends { folderId?: string }>(
  layout: T
): Omit<T, 'folderId'> {
  const { folderId: _folderId, ...rest } = layout;
  return rest;
}

export type ValidationResult =
  { valid: true; layout: LayoutShape } | { valid: false; error: ValidationError };

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
      // Dropping this stripped the recipient's only handle on the bin's design
      //; the payload it points at travels alongside as `linkedDesigns`.
      linkedDesignId: bin.linkedDesignId
        ? sanitizeString(bin.linkedDesignId, DESIGN_ID_MAX_LENGTH)
        : undefined,
      // The size lock is authoring intent, so a shared drawer arrives with the
      // same bins frozen the sender froze.
      locked: bin.locked === true ? true : undefined,
      // Pairing travels too, or a shared knife block arrives divorced from its
      // rest and every pair-expanding operation stops working on it.
      pairId: typeof bin.pairId === 'string' ? sanitizeString(bin.pairId, 64) : undefined,
      pairRole: bin.pairRole === 'block' || bin.pairRole === 'rest' ? bin.pairRole : undefined,
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
      drawer: sanitizeDrawer(drawer),
      layers: validatedLayers,
      bins: validatedBins,
      categories: validatedCategories,
      printBedSize: isNumber(layout.printBedSize) ? layout.printBedSize : undefined,
      printBedDepth: isNumber(layout.printBedDepth) ? layout.printBedDepth : undefined,
      gridUnitMm: isNumber(layout.gridUnitMm) ? layout.gridUnitMm : undefined,
      // Match the command/store invariant (1–200mm). A shared layout with a
      // zero/negative/extreme Y pitch would break canvas scaling and physical
      // dimensions, so out-of-range values fall back to a square grid.
      gridUnitMmY:
        isNumber(layout.gridUnitMmY) && layout.gridUnitMmY >= 1 && layout.gridUnitMmY <= 200
          ? layout.gridUnitMmY
          : undefined,
      heightUnitMm: isNumber(layout.heightUnitMm) ? layout.heightUnitMm : undefined,
      magnetAnchor:
        layout.magnetAnchor === 'edge' || layout.magnetAnchor === 'center'
          ? layout.magnetAnchor
          : undefined,
      ...(isValidFolderId(layout.folderId) ? { folderId: layout.folderId } : {}),
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

function isValidLayer(value: unknown): value is LayerShape {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNumber(value.height) &&
    inRange(value.height, SHARE_CONSTRAINTS.HEIGHT_MIN, SHARE_CONSTRAINTS.GRID_MAX)
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
    inRange(value.height, SHARE_CONSTRAINTS.HEIGHT_MIN, SHARE_CONSTRAINTS.GRID_MAX) &&
    optString(value.category) &&
    optString(value.label) &&
    optString(value.notes) &&
    optString(value.linkedDesignId)
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
