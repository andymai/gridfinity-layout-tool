/**
 * Aggregates every feature's `helpEntries` export plus the cross-cutting
 * shortcut catalog into a single flat list consumed by the Help modal search.
 *
 * Adding new entries: export `helpEntries: HelpEntry[]` from a feature's
 * barrel (`src/features/<name>/index.ts`), then add the import here.
 *
 * No `import.meta.glob` — the codebase has no precedent for it and the
 * single-line-per-feature cost is acceptable for the catalog size.
 */

import { helpEntries as gridEditorHelpEntries } from '@/features/grid-editor';
import { helpEntries as layersHelpEntries } from '@/features/layers';
import { helpEntries as categoriesHelpEntries } from '@/features/categories';
import { helpEntries as shellHelpEntries } from './shellHelpEntries';
import { shortcutCatalogToHelpEntries } from './shellShortcuts';
import type { HelpEntry } from './helpEntry';

export function getAllHelpEntries(): HelpEntry[] {
  return [
    ...shortcutCatalogToHelpEntries(),
    ...shellHelpEntries,
    ...gridEditorHelpEntries,
    ...layersHelpEntries,
    ...categoriesHelpEntries,
  ];
}
