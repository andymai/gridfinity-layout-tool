import type { HelpEntry } from '@/shared/help/helpEntry';

/**
 * Deliberately one entry rather than one per highlight: this module is
 * statically reachable from the app entry through `helpEntryAggregator`, so
 * anything it pulls lands in the eager bundle, including `entries.ts`, which
 * is the ~8kB the modal's lazy chunk exists to defer.
 */
export const helpEntries: HelpEntry[] = [
  {
    id: 'whats-new',
    kind: 'tip',
    titleKey: 'whatsNew.title',
    descriptionKey: 'whatsNew.helpDescription',
    keywordsKey: 'whatsNew.helpKeywords',
    category: 'general',
  },
];
