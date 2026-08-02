import type { SelectOption } from '@/design-system';
import type { TFunction } from '@/i18n';
import type { CommunityCategory, CommunityIndexSort } from '@/shared/types/community';
import { COMMUNITY_CATEGORIES, COMMUNITY_INDEX_SORTS } from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';

export const ALL_TECHNIQUES = Object.keys(TECHNIQUE_CONFIG) as readonly ExampleTechnique[];

export const CATEGORY_ALL = 'all';

const CATEGORY_LABEL_KEYS: Record<CommunityCategory, string> = {
  tools: 'community.category.tools',
  hardware: 'community.category.hardware',
  kitchen: 'community.category.kitchen',
  office: 'community.category.office',
  crafts: 'community.category.crafts',
  electronics: 'community.category.electronics',
  'toys-games': 'community.category.toysGames',
  other: 'community.category.other',
};

const SORT_LABEL_KEYS: Record<CommunityIndexSort, string> = {
  newest: 'community.gallery.sort.newest',
  remixes: 'community.gallery.sort.remixes',
  likes: 'community.gallery.sort.likes',
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

export function isCommunityCategory(value: string): value is CommunityCategory {
  return (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

export function isCommunitySort(value: string): value is CommunityIndexSort {
  return (COMMUNITY_INDEX_SORTS as readonly string[]).includes(value);
}
