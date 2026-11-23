function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Order-independent structural equality for JSON-shaped param objects. */
export function paramsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // A loaded design holds fresh arrays (`splitOverride` rows and cols).
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => paramsEqual(value, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => Object.hasOwn(b, key) && paramsEqual(a[key], b[key]));
  }
  return false;
}
