/**
 * Help entries owned by the categories feature. Surfaced in the global Help
 * modal search via `helpEntryAggregator`.
 */

import type { FeatureHelpEntry } from '@/shell/Modals/HelpModal/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
  {
    id: 'feature/categories/panel',
    kind: 'feature',
    titleKey: 'help.target.categories.title',
    descriptionKey: 'help.target.categories.description',
    keywordsKey: 'help.target.categories.keywords',
    category: 'layout',
    target: {
      surface: 'sidebar:categories',
      controlId: 'categories-panel',
    },
  },
];
