/**
 * Help entries owned by the layers feature. Surfaced in the global Help
 * modal search via `helpEntryAggregator`.
 */

import type { FeatureHelpEntry } from '@/shared/help/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
  {
    id: 'feature/layers/panel',
    kind: 'feature',
    titleKey: 'help.target.layers.title',
    descriptionKey: 'help.target.layers.description',
    keywordsKey: 'help.target.layers.keywords',
    category: 'layout',
    routes: ['layout'],
    target: {
      surface: 'sidebar:layers',
      controlId: 'layers-panel',
    },
  },
];
