import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Select, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useBrowseStore } from '../../store/browseStore';
import {
  DIMENSION_ANY,
  cardDepthRank,
  cardHeightRank,
  cardWidthRank,
  dimensionOptions,
  parseDimensionRank,
} from './galleryFilterOptions';

export interface DimensionFiltersProps {
  /** 'toolbar' = compact inline desktop row; 'sheet' = stacked mobile groups. */
  variant: 'toolbar' | 'sheet';
}

const LABEL_CLASS = 'text-xs font-medium uppercase tracking-wide text-content-tertiary';

export function DimensionFilters({ variant }: DimensionFiltersProps) {
  const t = useTranslation();
  const items = useBrowseStore((s) => s.items);
  const { widthMin, widthMax, depthMin, depthMax, maxHeight } = useBrowseStore(
    useShallow((s) => ({
      widthMin: s.filters.widthMin,
      widthMax: s.filters.widthMax,
      depthMin: s.filters.depthMin,
      depthMax: s.filters.depthMax,
      maxHeight: s.filters.maxHeight,
    }))
  );
  const setWidthMin = useBrowseStore((s) => s.setWidthMin);
  const setWidthMax = useBrowseStore((s) => s.setWidthMax);
  const setDepthMin = useBrowseStore((s) => s.setDepthMin);
  const setDepthMax = useBrowseStore((s) => s.setDepthMax);
  const setMaxHeight = useBrowseStore((s) => s.setMaxHeight);

  const sheet = variant === 'sheet';
  const selectSize = sheet ? 'lg' : 'md';
  const selectClass = sheet ? 'min-w-0 flex-1' : 'w-24';

  // Each list scans the full index (up to 2,000 cards); without memo the five
  // selects rebuild them on every keystroke in the search field.
  const widthOptions = useMemo(() => dimensionOptions(t, items, cardWidthRank), [t, items]);
  const depthOptions = useMemo(() => dimensionOptions(t, items, cardDepthRank), [t, items]);
  const heightOptions = useMemo(() => dimensionOptions(t, items, cardHeightRank), [t, items]);

  const rangeSelect = (
    value: number | null,
    onChange: (rank: number | null) => void,
    options: ReturnType<typeof dimensionOptions>,
    ariaLabelKey: string,
    testId: string
  ) => (
    <Select
      options={options}
      value={value === null ? DIMENSION_ANY : String(value)}
      onValueChange={(next) => onChange(parseDimensionRank(next))}
      aria-label={t(ariaLabelKey)}
      size={selectSize}
      className={selectClass}
      data-testid={testId}
    />
  );

  const widthMinField = rangeSelect(
    widthMin,
    setWidthMin,
    widthOptions,
    'community.gallery.widthMinLabel',
    'community-filter-width-min'
  );
  const widthMaxField = rangeSelect(
    widthMax,
    setWidthMax,
    widthOptions,
    'community.gallery.widthMaxLabel',
    'community-filter-width-max'
  );
  const depthMinField = rangeSelect(
    depthMin,
    setDepthMin,
    depthOptions,
    'community.gallery.depthMinLabel',
    'community-filter-depth-min'
  );
  const depthMaxField = rangeSelect(
    depthMax,
    setDepthMax,
    depthOptions,
    'community.gallery.depthMaxLabel',
    'community-filter-depth-max'
  );

  const widthFields = (
    <>
      {widthMinField}
      {widthMaxField}
    </>
  );

  const depthFields = (
    <>
      {depthMinField}
      {depthMaxField}
    </>
  );

  const heightField = rangeSelect(
    maxHeight,
    setMaxHeight,
    heightOptions,
    'community.gallery.maxHeightLabel',
    'community-filter-max-height'
  );

  if (sheet) {
    return (
      <div className="space-y-4" data-testid="community-dimension-filters">
        <div className="space-y-1.5">
          <div className={LABEL_CLASS}>{t('community.gallery.widthLabel')}</div>
          <div className="flex items-center gap-2">{widthFields}</div>
        </div>
        <div className="space-y-1.5">
          <div className={LABEL_CLASS}>{t('community.gallery.depthLabel')}</div>
          <div className="flex items-center gap-2">{depthFields}</div>
        </div>
        <div className="space-y-1.5">
          <div className={LABEL_CLASS}>{t('community.gallery.maxHeightLabel')}</div>
          {heightField}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="community-dimension-filters">
      <span className={LABEL_CLASS}>{t('community.gallery.widthLabel')}</span>
      {widthFields}
      <span className={cn(LABEL_CLASS, 'ml-2')}>{t('community.gallery.depthLabel')}</span>
      {depthFields}
      <span className={cn(LABEL_CLASS, 'ml-2')}>{t('community.gallery.maxHeightLabel')}</span>
      {heightField}
    </div>
  );
}
