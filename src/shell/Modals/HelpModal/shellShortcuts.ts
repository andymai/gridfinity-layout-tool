/**
 * Adapts the existing shortcut catalog into the `HelpEntry` shape so the
 * unified search ranks shortcuts alongside features and tips.
 *
 * Shortcuts stay shell-owned because grouping (General, Editing, Navigation, ...)
 * is cross-feature — forcing them into per-feature folders would create
 * orphaned categories and split logically-related rows.
 */

import { SHORTCUT_CATEGORIES } from './helpModalShortcutData';
import type { ShortcutHelpEntry } from './helpEntry';

export function shortcutCatalogToHelpEntries(): ShortcutHelpEntry[] {
  return SHORTCUT_CATEGORIES.flatMap((category) =>
    category.shortcuts.map<ShortcutHelpEntry>((shortcut) => ({
      // Use descriptionKey (stable, unique) — array indices drift on reorder
      // and silently break tests/telemetry pinned to specific shortcuts.
      id: `shortcut/${category.id}/${shortcut.descriptionKey}`,
      kind: 'shortcut',
      titleKey: shortcut.descriptionKey,
      descriptionKey: shortcut.descriptionKey,
      category: category.id,
      keys: shortcut.keys,
      modifier: shortcut.modifier,
      shift: shortcut.shift,
    }))
  );
}
