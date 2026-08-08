// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityCard } from '@/shared/types/community';
import {
  INITIAL_BROWSE_FILTERS,
  INITIAL_BROWSE_STATE,
  useBrowseStore,
} from '../../store/browseStore';
import { DimensionFilters } from './DimensionFilters';
import { computeFacetCounts } from './facetCounts';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

// Widths 1.5 and 2, depths 1 and 3, heights 3 and 6.
const ITEMS = [
  card('a', { metrics: { width: 62.5, depth: 41.5, height: 21, gridUnitMm: 42 } }),
  card('b', { metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 } }),
];

function renderFilters(items: readonly CommunityCard[] = ITEMS) {
  const counts = computeFacetCounts({
    items,
    filters: useBrowseStore.getState().filters,
    recentIds: [],
    fitsGapContext: null,
  });
  return render(<DimensionFilters items={items} counts={counts} />);
}

beforeEach(() => {
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: ITEMS });
});

describe('DimensionFilters', () => {
  it('lays each axis out on the values present in the index', () => {
    renderFilters();
    const widthMin = screen.getByLabelText('community.gallery.widthMinLabel');
    expect(widthMin).toHaveAttribute('aria-valuenow', '1.5');
    expect(screen.getByLabelText('community.gallery.widthMaxLabel')).toHaveAttribute(
      'aria-valuenow',
      '2'
    );
  });

  it('states the value instead of drawing a track for an axis with one stop', () => {
    // Every design 2 wide, so width has a single stop while depth and height
    // still vary. The slider is inert at one stop either way; drawn, it shows
    // both thumbs collapsed at the left beside a readout saying "Any", which
    // reads as a filter pinned to its minimum.
    const oneWidth = [
      card('a', { metrics: { width: 83.5, depth: 41.5, height: 21, gridUnitMm: 42 } }),
      card('b', { metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 } }),
    ];
    renderFilters(oneWidth);

    expect(screen.queryByLabelText('community.gallery.widthMinLabel')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('community.gallery.widthMaxLabel')).not.toBeInTheDocument();
    expect(screen.getByText('community.gallery.dimensionOnlyValue')).toBeInTheDocument();
    // The axes that can still narrow keep their sliders.
    expect(screen.getByLabelText('community.gallery.depthMinLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.maxHeightLabel')).toBeInTheDocument();
  });

  it('reads as unfiltered until a thumb is moved off the reachable edge', () => {
    renderFilters();
    expect(screen.getAllByText('community.gallery.dimensionAny')).toHaveLength(3);
    expect(useBrowseStore.getState().filters.widthMin).toBeNull();
  });

  it('writes a width bound when the lower thumb moves inward', () => {
    renderFilters();
    fireEvent.keyDown(screen.getByLabelText('community.gallery.widthMinLabel'), {
      key: 'ArrowRight',
    });
    expect(useBrowseStore.getState().filters.widthMin).toBe(2);
    expect(useBrowseStore.getState().filters.widthMax).toBeNull();
  });

  it('clears the bound again when the thumb returns to the edge', () => {
    useBrowseStore.getState().setWidthRange(2, null);
    renderFilters();
    fireEvent.keyDown(screen.getByLabelText('community.gallery.widthMinLabel'), {
      key: 'ArrowLeft',
    });
    expect(useBrowseStore.getState().filters.widthMin).toBeNull();
  });

  it('writes a depth bound from the upper thumb', () => {
    renderFilters();
    fireEvent.keyDown(screen.getByLabelText('community.gallery.depthMaxLabel'), {
      key: 'ArrowLeft',
    });
    expect(useBrowseStore.getState().filters.depthMax).toBe(1);
  });

  it('caps the height from the single-bound slider', () => {
    renderFilters();
    fireEvent.keyDown(screen.getByLabelText('community.gallery.maxHeightLabel'), {
      key: 'ArrowLeft',
    });
    expect(useBrowseStore.getState().filters.maxHeight).toBe(3);
  });

  it('shows the selected span instead of the unset label', () => {
    useBrowseStore.getState().setWidthRange(2, 2);
    renderFilters();
    expect(screen.getByText('2–2')).toBeInTheDocument();
  });

  it('keeps a stored bound reachable after another filter shrinks the window', () => {
    // Only the 1.5-wide card clears the height cap, so the stored width bound
    // of 2 now sits outside the reachable window.
    useBrowseStore.getState().setWidthRange(2, null);
    useBrowseStore.getState().setMaxHeight(3);
    renderFilters();
    const widthMin = screen.getByLabelText('community.gallery.widthMinLabel');
    expect(widthMin).toHaveAttribute('aria-valuenow', '2');
    fireEvent.keyDown(widthMin, { key: 'ArrowLeft' });
    expect(useBrowseStore.getState().filters.widthMin).toBeNull();
  });

  it('disables an axis with nothing left to reach', () => {
    const counts = computeFacetCounts({
      items: ITEMS,
      filters: { ...INITIAL_BROWSE_FILTERS, searchText: 'no-such-design' },
      recentIds: [],
      fitsGapContext: null,
    });
    render(<DimensionFilters items={ITEMS} counts={counts} />);
    expect(screen.getByLabelText('community.gallery.widthMinLabel')).toBeDisabled();
  });

  it('labels each axis', () => {
    renderFilters();
    expect(screen.getByText('community.gallery.widthLabel')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.depthLabel')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.maxHeightLabel')).toBeInTheDocument();
  });
});
