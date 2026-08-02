import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge, Button, IconButton, Input, Select } from '@/design-system';
import { SearchIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useBrowseStore, INITIAL_BROWSE_FILTERS } from '../../store/browseStore';
import { CommunityTechniquePills } from './CommunityTechniquePills';
import { FilterSheet } from './FilterSheet';
import {
  CATEGORY_ALL,
  categoryOptions,
  isCommunityCategory,
  isCommunitySort,
  sortOptions,
} from './galleryFilterOptions';

export function GalleryToolbar() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { filters } = useBrowseStore(useShallow((s) => ({ filters: s.filters })));
  const setSearchText = useBrowseStore((s) => s.setSearchText);
  const setCategory = useBrowseStore((s) => s.setCategory);
  const setTechnique = useBrowseStore((s) => s.setTechnique);
  const setSort = useBrowseStore((s) => s.setSort);
  const clearFilters = useBrowseStore((s) => s.clearFilters);

  const activeSheetFilterCount =
    (filters.category !== null ? 1 : 0) + (filters.technique !== null ? 1 : 0);
  const hasActiveFilters =
    filters.searchText !== INITIAL_BROWSE_FILTERS.searchText ||
    filters.category !== INITIAL_BROWSE_FILTERS.category ||
    filters.technique !== INITIAL_BROWSE_FILTERS.technique ||
    filters.sort !== INITIAL_BROWSE_FILTERS.sort;

  const searchField = (
    <Input
      type="search"
      value={filters.searchText}
      onChange={(e) => setSearchText(e.target.value)}
      placeholder={t('community.gallery.searchPlaceholder')}
      aria-label={t('community.gallery.searchLabel')}
      leftIcon={<SearchIcon aria-hidden="true" className="h-4 w-4" />}
      rightIcon={
        filters.searchText !== '' ? (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t('community.gallery.clearSearch')}
            onClick={() => setSearchText('')}
          >
            <XIcon className="h-3.5 w-3.5" />
          </IconButton>
        ) : undefined
      }
      wrapperClassName="min-w-0 flex-1"
    />
  );

  const sortField = (
    <Select
      options={sortOptions(t)}
      value={filters.sort}
      onValueChange={(value) => {
        if (isCommunitySort(value)) setSort(value);
      }}
      aria-label={t('community.gallery.sortLabel')}
      className={isMobile ? 'w-32' : 'w-40'}
    />
  );

  if (isMobile) {
    return (
      <div className="shrink-0 border-b border-stroke-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          {searchField}
          {sortField}
          <Button
            variant="secondary"
            onClick={() => setSheetOpen(true)}
            className="min-h-11 shrink-0"
          >
            {t('community.gallery.filters')}
            {activeSheetFilterCount > 0 && (
              <Badge tone="accent" shape="pill" size="sm" className="ml-1.5">
                <span aria-hidden="true">{activeSheetFilterCount}</span>
                <span className="sr-only">
                  {t('community.gallery.activeFilterCount', { count: activeSheetFilterCount })}
                </span>
              </Badge>
            )}
          </Button>
        </div>
        <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-2 border-b border-stroke-subtle px-4 py-2">
      <div className="flex items-center gap-2">
        {searchField}
        <Select
          options={categoryOptions(t)}
          value={filters.category ?? CATEGORY_ALL}
          onValueChange={(value) => {
            setCategory(isCommunityCategory(value) ? value : null);
          }}
          aria-label={t('community.gallery.categoryLabel')}
          className="w-44"
        />
        {sortField}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="shrink-0 text-sm">
            {t('community.gallery.clearFilters')}
          </Button>
        )}
      </div>
      <CommunityTechniquePills selected={filters.technique} onChange={setTechnique} />
    </div>
  );
}
