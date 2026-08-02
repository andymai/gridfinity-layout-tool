import { filterByTags } from '@/features/bin-designer/utils/tagFilter';
import { designFootprint } from '../../utils/designKind';
import type { SavedDesign } from '../../types';

export type SortOption = 'recent' | 'name' | 'size';

/** Sort option values - labels are generated dynamically via i18n */
export const SORT_OPTIONS: readonly SortOption[] = ['recent', 'name', 'size'] as const;

/** i18n key mapping for sort options */
export const SORT_OPTION_KEYS: Record<SortOption, string> = {
  recent: 'binDesigner.sortRecent',
  name: 'binDesigner.sortName',
  size: 'binDesigner.sortSize',
};

interface FilterAndSortOptions {
  activeTags: readonly string[];
  searchQuery: string;
  sortBy: SortOption;
  currentDesignId: string | null;
}

/**
 * Filter designs by active tags and search query, then sort by the chosen
 * option. The active design is always pinned first.
 */
export function filterAndSortDesigns(
  designs: readonly SavedDesign[],
  { activeTags, searchQuery, sortBy, currentDesignId }: FilterAndSortOptions
): SavedDesign[] {
  let filtered = filterByTags(designs, activeTags);
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((d) => d.name.toLowerCase().includes(query));
  }

  return [...filtered].sort((a, b) => {
    // Active design always first
    if (a.id === currentDesignId) return -1;
    if (b.id === currentDesignId) return 1;

    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size': {
        const af = designFootprint(a);
        const bf = designFootprint(b);
        const aSize = af.width * af.depth * Math.max(af.height, 1);
        const bSize = bf.width * bf.depth * Math.max(bf.height, 1);
        return bSize - aSize;
      }
      case 'recent':
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
}
