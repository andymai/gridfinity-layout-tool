/**
 * Help entries owned by the shell — for UI affordances that are not specific
 * to any single feature (e.g., global toggles in the sidebar header).
 */

import type { FeatureHelpEntry } from '@/shared/help/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
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
