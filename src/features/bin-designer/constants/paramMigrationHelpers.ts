/** Guards shared by the parameter migration steps. */

/** Clamp a number into [min, max], falling back to `fallback` when non-finite. */
export function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/**
 * Sanitize a persisted surface-text style override field-by-field: unknown
 * keys drop, enums must match, numbers must be finite and in the same ranges
 * the share/sync validator enforces (`api/lib/designerValidation.ts`
 * `validateTextDefaults`). Locally persisted or imported designs bypass that
 * server mirror, and a malformed depth/size here would flow straight into the
 * BREP worker via `resolveLidInputs`.
 */
export function isObj(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null;
}
