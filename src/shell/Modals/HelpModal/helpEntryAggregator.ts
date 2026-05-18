/**
 * Aggregates every feature's `helpEntries` export plus the cross-cutting
 * shortcut catalog into a single flat list consumed by the Help modal search.
 *
 * Adding new entries: export `helpEntries: HelpEntry[]` from a feature's
 * barrel (`src/features/<name>/index.ts`), then add the import here.
 *
 * Mode awareness: entries with `routes` are hidden on non-matching modes
 * (the destination surface usually isn't mounted on those modes anyway,
 * so jumps would silently fail). Pass `currentRoute` to filter.
 *
 * No `import.meta.glob` — the codebase has no precedent for it and the
 * single-line-per-feature cost is acceptable for the catalog size.
 */

import { helpEntries as gridEditorHelpEntries } from '@/features/grid-editor';
import { helpEntries as layersHelpEntries } from '@/features/layers';
import { helpEntries as categoriesHelpEntries } from '@/features/categories';
import { helpEntries as binDesignerHelpEntries } from '@/features/bin-designer';
import { helpEntries as shellHelpEntries } from './shellHelpEntries';
import { shortcutCatalogToHelpEntries } from './shellShortcuts';
import type { HelpEntry, HelpRoute } from '@/shared/help/helpEntry';

export function getAllHelpEntries(currentRoute?: HelpRoute): HelpEntry[] {
  const all: HelpEntry[] = [
    ...shortcutCatalogToHelpEntries(),
    ...shellHelpEntries,
    ...gridEditorHelpEntries,
    ...layersHelpEntries,
    ...categoriesHelpEntries,
    ...binDesignerHelpEntries,
  ];
  if (!currentRoute) return all;
  return all.filter((entry) => !entry.routes || entry.routes.includes(currentRoute));
}
