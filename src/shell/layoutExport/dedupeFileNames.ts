/**
 * Make a list of file names unique, preserving order.
 *
 * Two distinct bin designs can resolve to the same generated file name (same
 * dimensions/name under a compact style), and a ZIP keyed by a plain object
 * would silently overwrite the earlier one. This suffixes collisions (`-2`,
 * `-3`, …) before the extension so every part survives in the archive.
 */
export function dedupeFileNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  return names.map((name) => {
    if (!seen.has(name)) {
      seen.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot === -1 ? name : name.slice(0, dot);
    const ext = dot === -1 ? '' : name.slice(dot);
    let i = 2;
    let candidate = `${base}-${i}${ext}`;
    while (seen.has(candidate)) {
      i++;
      candidate = `${base}-${i}${ext}`;
    }
    seen.add(candidate);
    return candidate;
  });
}
