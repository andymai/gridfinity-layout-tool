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
  // Mirrors client `CONSTRAINTS.MIN_BIN_HEIGHT` / `MIN_LAYER_HEIGHT` (2).
  // Server <-> client divergence would let a peer persist height=1 that the
  // recipient's CQRS schema rejects on the next mutation.
  HEIGHT_MIN: 2,
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

interface OutlineVertexShape {
  x: number;
  y: number;
  bulge?: number;
}

interface CornerCutShape {
  kind: string;
  size?: number;
  r?: number;
  w?: number;
  d?: number;
}

interface DrawerOutlineShape {
  vertices: OutlineVertexShape[];
  authoring?: { kind: string; corners?: Record<string, CornerCutShape> };
}

interface DrawerShape {
  width: number;
  depth: number;
  height: number;
  fractionalEdgeX?: 'start' | 'end';
  fractionalEdgeY?: 'start' | 'end';
  outline?: DrawerOutlineShape;
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
      drawer: sanitizeDrawer(drawer),
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
  if (value.outline !== undefined && !isValidDrawerOutline(value.outline)) return false;
  return (
    isNumber(value.width) &&
    isNumber(value.depth) &&
    isNumber(value.height) &&
    value.width > 0 &&
    value.depth > 0 &&
    // HeightUnits (7mm each), capped at GRID_MAX so a corrupted client
    // can't sync absurd values to other devices.
    inRange(value.height, SHARE_CONSTRAINTS.HEIGHT_MIN, SHARE_CONSTRAINTS.GRID_MAX)
  );
}

/** Mirrors OUTLINE_MAX_VERTICES in src/shared/utils/drawerOutline.ts. */
const OUTLINE_MAX_VERTICES = 256;
/** 50 units × up to 52mm grid, with slack — mirrors the client Zod schema. */
const OUTLINE_COORD_MIN = -1;
const OUTLINE_COORD_MAX = 2600;
const OUTLINE_AUTHORING_KINDS = ['cells', 'corners', 'trace', 'pen'];

/**
 * Structural gate for a drawer outline (issue #2528): vertex/coordinate/bulge
 * bounds and no self-intersection of the straight-chord approximation. The
 * geometric invariants that need the drawer's mm extent (CCW, min area,
 * in-bounds) are enforced client-side and re-checked at read time by
 * normalizeDrawerOutline — the server's job is to bound the data so a
 * hand-crafted payload can't sync junk or pathological geometry.
 */
function isValidDrawerOutline(value: unknown): value is DrawerOutlineShape {
  if (!isObject(value) || !Array.isArray(value.vertices)) return false;
  const vertices = value.vertices as unknown[];
  if (vertices.length < 3 || vertices.length > OUTLINE_MAX_VERTICES) return false;
  for (const v of vertices) {
    if (!isObject(v)) return false;
    if (
      !isNumber(v.x) ||
      !isNumber(v.y) ||
      !inRange(v.x, OUTLINE_COORD_MIN, OUTLINE_COORD_MAX) ||
      !inRange(v.y, OUTLINE_COORD_MIN, OUTLINE_COORD_MAX)
    ) {
      return false;
    }
    if (v.bulge !== undefined && (!isNumber(v.bulge) || !inRange(v.bulge, -1, 1))) return false;
  }
  // `authoring` is non-geometric editor metadata: reject only structural
  // garbage. An unknown kind (a NEWER client's editor) must not invalidate
  // the layout — sanitizeDrawer drops unrecognized kinds instead.
  if (value.authoring !== undefined) {
    if (!isObject(value.authoring) || typeof value.authoring.kind !== 'string') return false;
  }
  const pts = vertices as OutlineVertexShape[];
  return !outlineChordsSelfIntersect(pts);
}

/** O(n²) chord test — arcs approximated by their chords; good enough to bound
 * pathological payloads (exact arc checks run client-side). Detects proper
 * crossings AND degenerate touches: collinear overlaps and endpoint-on-segment
 * contacts between non-adjacent chords (mirrors segmentsTouch in
 * src/shared/utils/drawerOutline.ts). */
function outlineChordsSelfIntersect(pts: OutlineVertexShape[]): boolean {
  const n = pts.length;
  const orient = (a: OutlineVertexShape, b: OutlineVertexShape, c: OutlineVertexShape): number => {
    const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(v) < 1e-9 ? 0 : Math.sign(v);
  };
  const onSegment = (
    a: OutlineVertexShape,
    b: OutlineVertexShape,
    p: OutlineVertexShape
  ): boolean =>
    Math.min(a.x, b.x) - 1e-6 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-6 &&
    Math.min(a.y, b.y) - 1e-6 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-6;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = pts[j];
      const d = pts[(j + 1) % n];
      const o1 = orient(a, b, c);
      const o2 = orient(a, b, d);
      const o3 = orient(c, d, a);
      const o4 = orient(c, d, b);
      if (o1 !== o2 && o3 !== o4) return true;
      if (o1 === 0 && onSegment(a, b, c)) return true;
      if (o2 === 0 && onSegment(a, b, d)) return true;
      if (o3 === 0 && onSegment(c, d, a)) return true;
      if (o4 === 0 && onSegment(c, d, b)) return true;
    }
  }
  return false;
}

/**
 * Rebuild the drawer field-by-field. The drawer previously passed through
 * raw, which let arbitrary junk keys survive sanitization; an explicit
 * rebuild keeps exactly the validated shape.
 */
function sanitizeDrawer(drawer: DrawerShape): DrawerShape {
  const out: DrawerShape = {
    width: drawer.width,
    depth: drawer.depth,
    height: drawer.height,
  };
  if (drawer.fractionalEdgeX === 'start' || drawer.fractionalEdgeX === 'end') {
    out.fractionalEdgeX = drawer.fractionalEdgeX;
  }
  if (drawer.fractionalEdgeY === 'start' || drawer.fractionalEdgeY === 'end') {
    out.fractionalEdgeY = drawer.fractionalEdgeY;
  }
  if (drawer.outline !== undefined) {
    out.outline = {
      vertices: drawer.outline.vertices.map((v) =>
        v.bulge === undefined || v.bulge === 0
          ? { x: v.x, y: v.y }
          : { x: v.x, y: v.y, bulge: v.bulge }
      ),
      ...(drawer.outline.authoring !== undefined &&
      OUTLINE_AUTHORING_KINDS.includes(drawer.outline.authoring.kind)
        ? {
            authoring: {
              kind: drawer.outline.authoring.kind,
              // The corners editor round-trips its per-corner params through
              // this annotation; keep them when every entry is structurally
              // valid, drop the whole map otherwise.
              ...(sanitizeCornerCuts(drawer.outline.authoring.corners) ?? {}),
            },
          }
        : {}),
    };
  }
  return out;
}

const CORNER_KEYS = ['tl', 'tr', 'bl', 'br'];
const CUT_MAX_MM = 2600;

function isValidCornerCut(value: unknown): value is CornerCutShape {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  switch (value.kind) {
    case 'none':
      return true;
    case 'chamfer':
      return isNumber(value.size) && inRange(value.size, 0, CUT_MAX_MM);
    case 'radius':
      return isNumber(value.r) && inRange(value.r, 0, CUT_MAX_MM);
    case 'notch':
      return (
        isNumber(value.w) &&
        inRange(value.w, 0, CUT_MAX_MM) &&
        isNumber(value.d) &&
        inRange(value.d, 0, CUT_MAX_MM)
      );
    default:
      return false;
  }
}

function sanitizeCornerCuts(corners: unknown): { corners: Record<string, CornerCutShape> } | null {
  if (!isObject(corners)) return null;
  const out: Record<string, CornerCutShape> = {};
  for (const key of CORNER_KEYS) {
    const cut = corners[key];
    if (!isValidCornerCut(cut)) return null;
    switch (cut.kind) {
      case 'none':
        out[key] = { kind: 'none' };
        break;
      case 'chamfer':
        out[key] = { kind: 'chamfer', size: cut.size };
        break;
      case 'radius':
        out[key] = { kind: 'radius', r: cut.r };
        break;
      default:
        out[key] = { kind: 'notch', w: cut.w, d: cut.d };
    }
  }
  return { corners: out };
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

export function sanitizeString(str: string, maxLength: number): string {
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
