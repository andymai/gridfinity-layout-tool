/**
 * Query-string codec for the browse filters, making a narrowed gallery
 * shareable, bookmarkable and reload-safe.
 *
 * Three rules shape it:
 *
 * - **Defaults are omitted.** An unfiltered gallery is `/community` with no
 *   query at all, so the common URL stays clean and a shared link carries only
 *   what the sender actually chose.
 * - **Only state the user stated travels.** `fitsGapContext` arrives from the
 *   layout editor and describes a gap in the sender's drawer, which means
 *   nothing in the recipient's browser; `mineOnly` is resolved per account, so
 *   a shared link would show the recipient their own designs rather than the
 *   sender's view. Both are deliberately excluded, which is why decoding
 *   returns a patch rather than a whole `BrowseFilters`.
 * - **A bad value is dropped, never fatal.** These strings are user-editable
 *   and outlive deploys: a category that has since been retired, or a hand-typed
 *   `w=banana`, drops that one parameter and leaves the rest of the view intact.
 */

import { COMMUNITY_CATEGORIES } from '@/shared/types/community';
import type { CommunityCategory } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import type { BrowseFilters, BrowseSort } from '../store/browseStore';
import { INITIAL_BROWSE_FILTERS } from '../store/browseStore';
import { isBrowseSort } from '../components/CommunityGalleryTab/galleryFilterOptions';

/** Mirrors AUTHOR_PUBLIC_ID_RE in api/community.ts. */
const AUTHOR_ID_RE = /^[a-f0-9]{32}$/;

/**
 * Search text is a filter, not a document: a URL carrying kilobytes of it is a
 * broken link in most clients, and nothing in the index is matched by more.
 */
const MAX_SEARCH_LENGTH = 100;

export const BROWSE_PARAM = {
  search: 'q',
  category: 'cat',
  technique: 'tech',
  sort: 'sort',
  width: 'w',
  depth: 'd',
  height: 'h',
  liked: 'liked',
  recent: 'recent',
  featured: 'featured',
  author: 'author',
} as const;

/**
 * The subset of filters the URL owns. Everything absent from a decoded patch
 * is left as the store has it, so the excluded filters above survive a decode.
 */
type UrlOwnedKey =
  | 'searchText'
  | 'category'
  | 'technique'
  | 'sort'
  | 'likedOnly'
  | 'recentOnly'
  | 'featuredOnly'
  | 'widthMin'
  | 'widthMax'
  | 'depthMin'
  | 'depthMax'
  | 'maxHeight'
  | 'author';

// `BrowseFilters` is readonly throughout, so the patch drops the modifier to
// be assembled field by field. It is still consumed as a plain partial.
export type BrowseUrlPatch = {
  -readonly [K in UrlOwnedKey]?: BrowseFilters[K];
};

function isCategory(value: string): value is CommunityCategory {
  return (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

function isTechnique(value: string): value is ExampleTechnique {
  return Object.prototype.hasOwnProperty.call(TECHNIQUE_CONFIG, value);
}

/**
 * Grid units at half steps. Rejects anything else outright rather than
 * rounding: a bound the user did not choose is worse than no bound, because
 * the grid would silently disagree with the URL that produced it.
 */
function parseUnits(raw: string): number | null {
  if (raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value * 2 === Math.round(value * 2) ? value : null;
}

function formatUnits(value: number): string {
  return String(value);
}

/**
 * A range is `min-max`, with either side omitted for a one-sided bound
 * (`2-` is "at least 2", `-4` is "at most 4"). Crossed bounds are dropped
 * whole: honouring them would render a slider whose thumbs have swapped.
 */
function parseRange(raw: string): { min: number | null; max: number | null } | null {
  const parts = raw.split('-');
  if (parts.length !== 2) return null;
  const [lower, upper] = parts;
  const min = parseUnits(lower);
  const max = parseUnits(upper);
  if (min === null && max === null) return null;
  if (lower !== '' && min === null) return null;
  if (upper !== '' && max === null) return null;
  if (min !== null && max !== null && min > max) return null;
  return { min, max };
}

function formatRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  return `${min === null ? '' : formatUnits(min)}-${max === null ? '' : formatUnits(max)}`;
}

/** Present-means-true, so an inactive toggle costs no characters. */
function readFlag(params: URLSearchParams, key: string): boolean | undefined {
  return params.has(key) ? true : undefined;
}

export function encodeBrowseParams(filters: BrowseFilters): URLSearchParams {
  const params = new URLSearchParams();
  const search = filters.searchText.trim();
  if (search !== '') params.set(BROWSE_PARAM.search, search.slice(0, MAX_SEARCH_LENGTH));
  if (filters.category !== null) params.set(BROWSE_PARAM.category, filters.category);
  if (filters.technique !== null) params.set(BROWSE_PARAM.technique, filters.technique);
  // 'best-fit' is excluded with the gap context it depends on: it falls back to
  // 'newest' the moment no dimension constraint remains, so a recipient would
  // land on a sort that immediately rewrites itself.
  if (filters.sort !== INITIAL_BROWSE_FILTERS.sort && filters.sort !== 'best-fit') {
    params.set(BROWSE_PARAM.sort, filters.sort);
  }
  const width = formatRange(filters.widthMin, filters.widthMax);
  if (width !== null) params.set(BROWSE_PARAM.width, width);
  const depth = formatRange(filters.depthMin, filters.depthMax);
  if (depth !== null) params.set(BROWSE_PARAM.depth, depth);
  if (filters.maxHeight !== null) params.set(BROWSE_PARAM.height, formatUnits(filters.maxHeight));
  if (filters.likedOnly) params.set(BROWSE_PARAM.liked, '1');
  if (filters.recentOnly) params.set(BROWSE_PARAM.recent, '1');
  if (filters.featuredOnly) params.set(BROWSE_PARAM.featured, '1');
  if (filters.author !== null) params.set(BROWSE_PARAM.author, filters.author.id);
  return params;
}

export function decodeBrowseParams(params: URLSearchParams): BrowseUrlPatch {
  const patch: BrowseUrlPatch = {
    // Absent means default, not "leave as is": arriving on a link without a
    // parameter has to clear whatever the store was holding, or navigating
    // back from a narrowed view would keep its filters.
    searchText: INITIAL_BROWSE_FILTERS.searchText,
    category: null,
    technique: null,
    sort: INITIAL_BROWSE_FILTERS.sort,
    likedOnly: false,
    recentOnly: false,
    featuredOnly: false,
    widthMin: null,
    widthMax: null,
    depthMin: null,
    depthMax: null,
    maxHeight: null,
    author: null,
  };

  const search = params.get(BROWSE_PARAM.search);
  if (search !== null && search.trim() !== '') {
    patch.searchText = search.trim().slice(0, MAX_SEARCH_LENGTH);
  }

  const category = params.get(BROWSE_PARAM.category);
  if (category !== null && isCategory(category)) patch.category = category;

  const technique = params.get(BROWSE_PARAM.technique);
  if (technique !== null && isTechnique(technique)) patch.technique = technique;

  const sort = params.get(BROWSE_PARAM.sort);
  if (sort !== null && isBrowseSort(sort) && sort !== 'best-fit') {
    patch.sort = sort satisfies BrowseSort;
  }

  const width = params.get(BROWSE_PARAM.width);
  if (width !== null) {
    const range = parseRange(width);
    if (range !== null) {
      patch.widthMin = range.min;
      patch.widthMax = range.max;
    }
  }

  const depth = params.get(BROWSE_PARAM.depth);
  if (depth !== null) {
    const range = parseRange(depth);
    if (range !== null) {
      patch.depthMin = range.min;
      patch.depthMax = range.max;
    }
  }

  const height = params.get(BROWSE_PARAM.height);
  if (height !== null) patch.maxHeight = parseUnits(height);

  patch.likedOnly = readFlag(params, BROWSE_PARAM.liked) ?? false;
  patch.recentOnly = readFlag(params, BROWSE_PARAM.recent) ?? false;
  patch.featuredOnly = readFlag(params, BROWSE_PARAM.featured) ?? false;

  const author = params.get(BROWSE_PARAM.author);
  if (author !== null && AUTHOR_ID_RE.test(author)) {
    // The display name is not in the URL; a cold visit resolves it from the
    // index once one of the author's cards has loaded.
    patch.author = { id: author, name: '' };
  }

  return patch;
}
