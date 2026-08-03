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
import type { BrowseSort } from '../../store/browseStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { cardDimensionUnits, formatUnits } from '../CommunityCard/cardDims';

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

export const DIMENSION_ANY = '';

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
 * Faceted options derived from the loaded index (only values that exist among
 * the cards), prefixed with an "Any" clearing sentinel.
 */
export function dimensionOptions(
  t: TFunction,
  items: readonly CommunityCard[],
  rankOf: (card: CommunityCard) => number
): SelectOption[] {
  const ranks = Array.from(new Set(items.map(rankOf))).sort((a, b) => a - b);
  return [
    { id: DIMENSION_ANY, name: t('community.gallery.dimensionAny') },
    ...ranks.map((rank) => ({ id: String(rank), name: formatUnits(rank) })),
  ];
}

export function parseDimensionRank(value: string): number | null {
  if (value === DIMENSION_ANY) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
