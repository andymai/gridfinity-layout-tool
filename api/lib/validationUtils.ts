/**
 * Shared validation primitives used across API validation modules.
 */

export function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
}

export function inRange(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

export function isString(val: unknown): val is string {
  return typeof val === 'string';
}

export function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function validationError<C extends string>(code: C, message: string) {
  return { valid: false as const, error: { code, message } };
}
