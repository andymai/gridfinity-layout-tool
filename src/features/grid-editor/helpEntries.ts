/**
 * Help entries owned by the grid-editor feature. Surfaced in the global
 * Help modal search via `helpEntryAggregator`.
 */

import type { FeatureHelpEntry } from '@/shell/Modals/HelpModal/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
  {
    id: 'feature/grid-editor/print-bed-size',
    kind: 'feature',
    titleKey: 'help.target.printBedSize.title',
    descriptionKey: 'help.target.printBedSize.description',
    keywordsKey: 'help.target.printBedSize.keywords',
    category: 'settings',
    target: {
      surface: 'sidebar:physical-units',
      controlId: 'print-bed-size',
    },
  },
];
