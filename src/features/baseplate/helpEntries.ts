import type { FeatureHelpEntry } from '@/shared/help/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
  {
    id: 'feature/baseplate/print-bed-size',
    kind: 'feature',
    titleKey: 'help.target.baseplate.printBedSize.title',
    descriptionKey: 'help.target.baseplate.printBedSize.description',
    keywordsKey: 'help.target.baseplate.printBedSize.keywords',
    category: 'settings',
    routes: ['baseplate'],
    target: { surface: 'baseplate:print-settings', controlId: 'bp-print-bed-size' },
  },
];
