import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Field, RangeSlider, Slider, cn } from '@/design-system';
import type { RangeValue } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityCard } from '@/shared/types/community';
import { useBrowseStore } from '../../store/browseStore';
import { formatUnits } from '../CommunityCard/cardDims';
import type { DimensionWindow, FacetCounts } from './facetCounts';
import { dimensionStops } from './facetCounts';
import { cardDepthRank, cardHeightRank, cardWidthRank } from './galleryFilterOptions';

export interface DimensionFiltersProps {
  /** The loaded index, for the stop list each axis is laid out on. */
  items: readonly CommunityCard[];
  counts: FacetCounts;
  /** Roomier rows for touch surfaces. */
  touchSize?: boolean;
}

/**
 * Displayed bounds for one axis. An unset bound sits at the edge of what is
 * still reachable, so a slider spanning its whole filled track means "no
 * narrowing" rather than a bound that happens to exclude nothing.
 */
function displayRange(min: number | null, max: number | null, window: DimensionWindow): RangeValue {
  if (min !== null && max !== null) return [min, max];
  // A bound left over from a looser filter can sit outside what is currently
  // reachable. The unset end then has to yield to it, or the two cross and the
  // slider silently swaps which thumb is which.
  if (min !== null) return [min, Math.max(window.max, min)];
  if (max !== null) return [Math.min(window.min, max), max];
  return [window.min, window.max];
}

/**
 * Where the thumbs may travel: the reachable window, widened to keep an
 * already-stored bound reachable. Without the widening, a bound left behind by
 * an earlier, looser filter would be stranded outside the track with no way to
 * drag it back off.
 */
function travelRange(value: RangeValue, window: DimensionWindow): RangeValue {
  return [Math.min(window.min, value[0]), Math.max(window.max, value[1])];
}

/** Index of the first stop at or above `value`, or the last stop when none is. */
function stopIndex(stops: readonly number[], value: number): number {
  const found = stops.findIndex((stop) => stop >= value);
  return found === -1 ? Math.max(0, stops.length - 1) : found;
}

function Readout({ text, muted }: { text: string; muted: boolean }) {
  return (
    <span
      className={cn(
        'text-sm tabular-nums',
        muted ? 'text-content-tertiary' : 'font-semibold text-content'
      )}
    >
      {text}
    </span>
  );
}

export function DimensionFilters({ items, counts, touchSize = false }: DimensionFiltersProps) {
  const t = useTranslation();
  const { widthMin, widthMax, depthMin, depthMax, maxHeight } = useBrowseStore(
    useShallow((s) => ({
      widthMin: s.filters.widthMin,
      widthMax: s.filters.widthMax,
      depthMin: s.filters.depthMin,
      depthMax: s.filters.depthMax,
      maxHeight: s.filters.maxHeight,
    }))
  );
  const setWidthRange = useBrowseStore((s) => s.setWidthRange);
  const setDepthRange = useBrowseStore((s) => s.setDepthRange);
  const setMaxHeight = useBrowseStore((s) => s.setMaxHeight);

  // Each list scans the full index (up to 2,000 cards); without memo the three
  // tracks rebuild them on every keystroke in the search field.
  const widthStops = useMemo(() => dimensionStops(items, cardWidthRank), [items]);
  const depthStops = useMemo(() => dimensionStops(items, cardDepthRank), [items]);
  const heightStops = useMemo(() => dimensionStops(items, cardHeightRank), [items]);

  /**
   * An axis every loaded design shares. The slider is inert at one stop either
   * way, but drawing the track anyway puts a full-width control with both
   * thumbs collapsed at its left end beside a readout saying "Any", which
   * reads as a filter pinned to its minimum rather than as an axis with
   * nothing to choose.
   */
  const singleValueAxis = (label: string, stop: number) => (
    <Field label={label} trailing={<Readout muted text={formatUnits(stop)} />}>
      <span className="sr-only">
        {t('community.gallery.dimensionOnlyValue', { value: formatUnits(stop) })}
      </span>
    </Field>
  );

  const axis = (
    label: string,
    stops: readonly number[],
    window: DimensionWindow | null,
    min: number | null,
    max: number | null,
    apply: (min: number | null, max: number | null) => void,
    lowerLabelKey: string,
    upperLabelKey: string
  ) => {
    const empty = window === null || stops.length === 0;
    const bounds = window ?? { min: stops.at(0) ?? 0, max: stops.at(-1) ?? 0 };
    const value = displayRange(min, max, bounds);
    const isDefault = min === null && max === null;
    if (!empty && stops.length < 2) return singleValueAxis(label, stops[0]);
    return (
      <Field
        label={label}
        trailing={
          <Readout
            muted={isDefault}
            text={
              isDefault
                ? t('community.gallery.dimensionAny')
                : `${formatUnits(value[0])}–${formatUnits(value[1])}`
            }
          />
        }
      >
        <RangeSlider
          stops={stops}
          value={value}
          selectable={travelRange(value, bounds)}
          disabled={empty}
          muted={isDefault}
          formatValue={formatUnits}
          lowerLabel={t(lowerLabelKey)}
          upperLabel={t(upperLabelKey)}
          onChange={([lower, upper]) => {
            // Landing on the edge of what is reachable is the same statement
            // as "no bound", so it clears rather than freezing a no-op filter.
            apply(lower <= bounds.min ? null : lower, upper >= bounds.max ? null : upper);
          }}
        />
      </Field>
    );
  };

  const heightWindow = counts.height;
  const heightBounds = heightWindow ?? {
    min: heightStops.at(0) ?? 0,
    max: heightStops.at(-1) ?? 0,
  };
  const heightValue = maxHeight ?? heightBounds.max;
  const heightIndex = stopIndex(heightStops, heightValue);
  const heightTravelMin = Math.min(stopIndex(heightStops, heightBounds.min), heightIndex);
  const heightTravelMax = Math.max(stopIndex(heightStops, heightBounds.max), heightIndex);
  const heightStop = heightStops.at(heightIndex) ?? heightValue;

  const widthAxis = axis(
    t('community.gallery.widthLabel'),
    widthStops,
    counts.width,
    widthMin,
    widthMax,
    setWidthRange,
    'community.gallery.widthMinLabel',
    'community.gallery.widthMaxLabel'
  );
  const depthAxis = axis(
    t('community.gallery.depthLabel'),
    depthStops,
    counts.depth,
    depthMin,
    depthMax,
    setDepthRange,
    'community.gallery.depthMinLabel',
    'community.gallery.depthMaxLabel'
  );
  const heightSingleValue = heightWindow !== null && heightStops.length === 1;
  const heightSlider = (
    <Field
      label={t('community.gallery.maxHeightLabel')}
      trailing={
        <Readout
          muted={maxHeight === null}
          text={maxHeight === null ? t('community.gallery.dimensionAny') : formatUnits(heightStop)}
        />
      }
    >
      <Slider
        value={heightIndex}
        min={heightTravelMin}
        max={heightTravelMax}
        step={1}
        disabled={heightWindow === null || heightStops.length < 2}
        muted={maxHeight === null}
        aria-label={t('community.gallery.maxHeightLabel')}
        aria-valuetext={formatUnits(heightStop)}
        onChange={(index) => {
          const next = heightStops.at(index);
          if (next === undefined) return;
          setMaxHeight(next >= heightBounds.max ? null : next);
        }}
      />
    </Field>
  );

  return (
    <div className={cn('space-y-2', touchSize && 'space-y-3')} data-testid="community-size-filters">
      {widthAxis}
      {depthAxis}
      {heightSingleValue
        ? singleValueAxis(t('community.gallery.maxHeightLabel'), heightStops[0])
        : heightSlider}
    </div>
  );
}
