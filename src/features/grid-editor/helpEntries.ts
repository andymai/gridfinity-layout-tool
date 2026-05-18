/**
 * Help entries owned by the grid-editor feature. Surfaced in the global
 * Help modal search via `helpEntryAggregator`.
 *
 * All entries here target Sidebar surfaces that only exist on the layout-
 * planner route, so they're scoped to `routes: ['layout']`.
 */

import type { FeatureHelpEntry } from '@/shared/help/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
  {
    id: 'feature/grid-editor/print-bed-size',
    kind: 'feature',
    titleKey: 'help.target.printBedSize.title',
    descriptionKey: 'help.target.printBedSize.description',
    keywordsKey: 'help.target.printBedSize.keywords',
    category: 'settings',
    routes: ['layout'],
    target: {
      surface: 'sidebar:physical-units',
      controlId: 'print-bed-size',
    },
  },
  {
    id: 'feature/grid-editor/drawer-size',
    kind: 'feature',
    titleKey: 'help.target.drawerSize.title',
    descriptionKey: 'help.target.drawerSize.description',
    keywordsKey: 'help.target.drawerSize.keywords',
    category: 'settings',
    routes: ['layout'],
    target: {
      surface: 'sidebar:grid-size',
      controlId: 'drawer-size',
    },
  },
  {
    id: 'feature/grid-editor/grid-unit',
    kind: 'feature',
    titleKey: 'help.target.gridUnit.title',
    descriptionKey: 'help.target.gridUnit.description',
    keywordsKey: 'help.target.gridUnit.keywords',
    category: 'settings',
    routes: ['layout'],
    target: {
      surface: 'sidebar:physical-units',
      controlId: 'grid-unit',
    },
  },
  {
    id: 'feature/grid-editor/height-unit',
    kind: 'feature',
    titleKey: 'help.target.heightUnit.title',
    descriptionKey: 'help.target.heightUnit.description',
    keywordsKey: 'help.target.heightUnit.keywords',
    category: 'settings',
    routes: ['layout'],
    target: {
      surface: 'sidebar:physical-units',
      controlId: 'height-unit',
    },
  },
];
