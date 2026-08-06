import type { SelectOption } from '@/design-system';
import type { TFunction } from '@/i18n';
import type {
  CommunityCard,
  CommunityCategory,
  CommunityIndexSort,
} from '@/shared/types/community';
import { COMMUNITY_CATEGORIES, COMMUNITY_INDEX_SORTS } from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import type { BrowseFilters, BrowseSort } from '../../store/browseStore';
import { hasDimensionConstraints } from '../../store/browseStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { cardDimensionUnits } from '../CommunityCard/cardDims';

export function cardWidthRank(card: CommunityCard): number {
  return cardDimensionUnits(card.metrics).width;
}

export function cardDepthRank(card: CommunityCard): number {
  return cardDimensionUnits(card.metrics).depth;
}

export function cardHeightRank(card: CommunityCard): number {
  return cardDimensionUnits(card.metrics).height;
}

export const ALL_TECHNIQUES = Object.keys(TECHNIQUE_CONFIG) as readonly ExampleTechnique[];

export const CATEGORY_ALL = 'all';

const SORT_LABEL_KEYS: Record<CommunityIndexSort, string> = {
  newest: 'community.gallery.sort.newest',
  remixes: 'community.gallery.sort.remixes',
  likes: 'community.gallery.sort.likes',
  prints: 'community.gallery.sort.prints',
};

export function categoryOptions(t: TFunction): SelectOption[] {
  return [
    { id: CATEGORY_ALL, name: t('community.gallery.categoryAll') },
    ...COMMUNITY_CATEGORIES.map((category) => ({
      id: category,
      name: t(CATEGORY_LABEL_KEYS[category]),
    })),
  ];
}

export function sortOptions(t: TFunction): SelectOption[] {
  return COMMUNITY_INDEX_SORTS.map((sort) => ({ id: sort, name: t(SORT_LABEL_KEYS[sort]) }));
}

/**
 * Best-fit is appended only while available (a dimension constraint or gap
 * context is active): a missing option beats a disabled one with no visible
 * reason. Kept out of SORT_LABEL_KEYS so the server-mirrored
 * CommunityIndexSort record stays untouched.
 */
export function browseSortOptions(t: TFunction, includeBestFit: boolean): SelectOption[] {
  const base = sortOptions(t);
  if (!includeBestFit) return base;
  return [...base, { id: 'best-fit', name: t('community.gallery.sort.bestFit') }];
}

/**
 * Filters the panel owns, counted as one per facet rather than one per input:
 * the three size sliders read as a single "size" decision to the person who
 * set them, so a width range plus a height cap is 1, not 3.
 */
export function countPanelFilters(filters: BrowseFilters): number {
  return (
    (filters.category !== null ? 1 : 0) +
    (filters.technique !== null ? 1 : 0) +
    (hasDimensionConstraints(filters) ? 1 : 0) +
    (filters.likedOnly ? 1 : 0) +
    (filters.recentOnly ? 1 : 0) +
    (filters.featuredOnly ? 1 : 0) +
    (filters.mineOnly ? 1 : 0)
  );
}

export function isCommunityCategory(value: string): value is CommunityCategory {
  return (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

export function isCommunitySort(value: string): value is CommunityIndexSort {
  return (COMMUNITY_INDEX_SORTS as readonly string[]).includes(value);
}

export function isBrowseSort(value: string): value is BrowseSort {
  return value === 'best-fit' || isCommunitySort(value);
}
