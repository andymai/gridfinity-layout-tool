/**
 * Help entries owned by the shell — for UI affordances that are not specific
 * to any single feature (e.g., global toggles in the sidebar header).
 */

import type { HelpEntry } from '@/shared/help/helpEntry';

export const helpEntries: HelpEntry[] = [
  // `export` is the single most-searched term that returned nothing, together
  // with its misspellings and translations (expo, esport, esporta, download);
  // `save` and `saving designs` are next. Both are tips rather than feature
  // entries because no help surface reaches the header yet, and an entry that
  // answers the question beats a jump that does not exist.
  {
    id: 'tip/shell/export-files',
    kind: 'tip',
    titleKey: 'help.tip.exportFiles.title',
    descriptionKey: 'help.tip.exportFiles.description',
    keywordsKey: 'help.tip.exportFiles.keywords',
    category: 'export',
  },
  {
    id: 'tip/shell/saving-work',
    kind: 'tip',
    titleKey: 'help.tip.savingWork.title',
    descriptionKey: 'help.tip.savingWork.description',
    keywordsKey: 'help.tip.savingWork.keywords',
    category: 'export',
  },
  {
    id: 'feature/shell/half-bin-mode',
    kind: 'feature',
    titleKey: 'help.target.halfBinMode.title',
    descriptionKey: 'help.target.halfBinMode.description',
    keywordsKey: 'help.target.halfBinMode.keywords',
    category: 'settings',
    routes: ['layout'],
    target: {
      surface: 'sidebar:grid-size',
      controlId: 'half-bin-mode',
    },
  },
];
