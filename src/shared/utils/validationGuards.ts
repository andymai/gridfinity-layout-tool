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
    typeof obj.height === 'number' &&
    Number.isFinite(obj.x) &&
    Number.isFinite(obj.y) &&
    Number.isFinite(obj.width) &&
    Number.isFinite(obj.depth) &&
    Number.isFinite(obj.height) &&
    obj.width > 0 &&
    obj.depth > 0 &&
    obj.height > 0
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
    typeof obj.id === 'string' && typeof obj.name === 'string' && typeof obj.color === 'string'
  );
}
