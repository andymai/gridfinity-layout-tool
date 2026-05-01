/**
 * Type guards for runtime validation of imported layout data.
 *
 * These shape interfaces describe the **raw** untyped JSON we accept on
 * import — they are intentionally narrower than `core/types.ts` (no
 * branded types, no required category/label/notes) so a partially-formed
 * imported document can still pass the structural gate before the rest of
 * the validators apply business rules.
 */

export interface DrawerShape {
  width: number;
  depth: number;
  height: number;
}

export interface LayerShape {
  id: string;
  name: string;
  height: number;
}

export interface BinShape {
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

export interface CategoryShape {
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
    typeof obj.height === 'number' &&
    Number.isFinite(obj.width) &&
    Number.isFinite(obj.depth) &&
    Number.isFinite(obj.height) &&
    obj.width > 0 &&
    obj.depth > 0 &&
    obj.height > 0
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
    typeof obj.height === 'number' &&
    Number.isFinite(obj.height) &&
    obj.height > 0
  );
}

/**
 * Type guard to check if value is a valid bin object.
 *
 * Validates required numeric fields AND, when the optional string fields
 * are present, that they're actual strings — so downstream code can safely
 * call `.trim()` on `label`/`notes`/`category` after the guard narrows the
 * type. `customProperties`, when present, must be a plain object whose
 * values are strings (mirrors `validateCustomProperties`).
 *
 * @param value - Unknown value to check
 * @returns True if value matches BinShape
 */
export function isValidBin(value: unknown): value is BinShape {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.layerId !== 'string' ||
    typeof obj.x !== 'number' ||
    typeof obj.y !== 'number' ||
    typeof obj.width !== 'number' ||
    typeof obj.depth !== 'number' ||
    typeof obj.height !== 'number' ||
    !Number.isFinite(obj.x) ||
    !Number.isFinite(obj.y) ||
    !Number.isFinite(obj.width) ||
    !Number.isFinite(obj.depth) ||
    !Number.isFinite(obj.height) ||
    obj.width <= 0 ||
    obj.depth <= 0 ||
    obj.height <= 0
  ) {
    return false;
  }
  // Optional string fields: when present, must actually be strings.
  if (obj.category !== undefined && typeof obj.category !== 'string') return false;
  if (obj.label !== undefined && typeof obj.label !== 'string') return false;
  if (obj.notes !== undefined && typeof obj.notes !== 'string') return false;
  // customProperties (when present) must be a plain object of string values.
  if (obj.customProperties !== undefined) {
    if (
      !obj.customProperties ||
      typeof obj.customProperties !== 'object' ||
      Array.isArray(obj.customProperties)
    ) {
      return false;
    }
    for (const v of Object.values(obj.customProperties as Record<string, unknown>)) {
      if (typeof v !== 'string') return false;
    }
  }
  return true;
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
    typeof obj.id === 'string' && typeof obj.name === 'string' && typeof obj.color === 'string'
  );
}
