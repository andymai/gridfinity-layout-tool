/**
 * Display text for a shortcut from `SHORTCUTS`, which stores `event.key`
 * values ('z', ['Delete', 'Backspace']). Letters print as key caps do, in
 * uppercase; named keys and symbols print unchanged.
 */
export function formatShortcutKeys(keys: string | readonly string[]): string {
  const list: readonly string[] = typeof keys === 'string' ? [keys] : keys;
  return list.map((key) => (key.length === 1 ? key.toUpperCase() : key)).join(' / ');
}
