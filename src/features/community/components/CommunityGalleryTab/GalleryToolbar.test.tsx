// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useGapFitStore } from '@/core/store/gapFit';
import { gridUnits, heightUnits, layerId } from '@/core/types';
import type { Mm } from '@/core/types';
import { ALL_TECHNIQUES } from './galleryFilterOptions';
import {
  INITIAL_BROWSE_FILTERS,
  INITIAL_BROWSE_STATE,
  useBrowseStore,
} from '../../store/browseStore';
import { GalleryToolbar } from './GalleryToolbar';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const responsiveMock = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => responsiveMock,
}));

function renderToolbar(props: Partial<React.ComponentProps<typeof GalleryToolbar>> = {}) {
  const onTogglePanel = vi.fn();
  render(
    <GalleryToolbar
      panelOpen={false}
      onTogglePanel={onTogglePanel}
      activeFilterCount={0}
      {...props}
    />
  );
  return { onTogglePanel };
}

beforeEach(() => {
  responsiveMock.isMobile = false;
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
  useGapFitStore.setState({ constraint: null });
  useSessionStore.setState({ status: 'anonymous', user: null });
});

afterEach(() => {
  useSessionStore.setState({ status: 'unknown', user: null });
});

describe('GalleryToolbar', () => {
  it('keeps the control row to the filter toggle, search and sort', () => {
    renderToolbar();
    expect(screen.getByTestId('community-filter-button')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.searchLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.sortLabel')).toBeInTheDocument();
    // Every facet now lives in the panel, not in this row.
    expect(screen.queryByLabelText('community.gallery.categoryLabel')).toBeNull();
    expect(screen.queryByTestId('community-size-filters')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('reports the panel state on the toggle and hands the click back', () => {
    const { onTogglePanel } = renderToolbar();
    const button = screen.getByTestId('community-filter-button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(onTogglePanel).toHaveBeenCalledOnce();
  });

  it('drops its toggle once the rail is open, leaving the rail its own collapse control', () => {
    renderToolbar({ panelOpen: true });
    expect(screen.queryByTestId('community-filter-button')).toBeNull();
  });

  it('keeps the toggle on mobile, where the filter view has no rail header', () => {
    responsiveMock.isMobile = true;
    renderToolbar({ panelOpen: true });
    expect(screen.getByTestId('community-filter-button')).toBeInTheDocument();
  });

  it('drops the toggle when there is nothing to narrow', () => {
    renderToolbar({ filtersAvailable: false });
    expect(screen.queryByTestId('community-filter-button')).toBeNull();
  });

  it('badges the toggle with the active filter count', () => {
    renderToolbar({ activeFilterCount: 3 });
    expect(screen.getByTestId('community-filter-button')).toHaveTextContent('3');
    expect(screen.getByText('community.gallery.activeFilterCount')).toBeInTheDocument();
  });

  it('leaves the badge off when nothing is filtered', () => {
    renderToolbar();
    expect(screen.queryByText('community.gallery.activeFilterCount')).toBeNull();
  });

  it('writes search text to the browse store and clears it via the clear button', () => {
    renderToolbar();
    const search = screen.getByLabelText('community.gallery.searchLabel');
    fireEvent.change(search, { target: { value: 'screws' } });
    expect(useBrowseStore.getState().filters.searchText).toBe('screws');
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearSearch' }));
    expect(useBrowseStore.getState().filters.searchText).toBe('');
  });

  it('updates the sort', () => {
    renderToolbar();
    fireEvent.change(screen.getByLabelText('community.gallery.sortLabel'), {
      target: { value: 'likes' },
    });
    expect(useBrowseStore.getState().filters.sort).toBe('likes');
  });

  it('offers best-fit only while a dimension constraint is active', () => {
    renderToolbar();
    const sortSelect = screen.getByLabelText('community.gallery.sortLabel');
    const optionIds = () => Array.from(sortSelect.querySelectorAll('option')).map((o) => o.value);
    expect(optionIds()).not.toContain('best-fit');
    act(() => {
      useBrowseStore.getState().setWidthMax(2);
    });
    expect(optionIds()).toContain('best-fit');
    fireEvent.change(sortSelect, { target: { value: 'best-fit' } });
    expect(useBrowseStore.getState().filters.sort).toBe('best-fit');
  });

  it('offers best-fit while a fits-gap context is set without toolbar constraints', () => {
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2,
      depthMax: 3,
      maxHeight: null,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    renderToolbar();
    const sortSelect = screen.getByLabelText('community.gallery.sortLabel');
    expect(Array.from(sortSelect.querySelectorAll('option')).map((o) => o.value)).toContain(
      'best-fit'
    );
  });
});

describe('GalleryToolbar active filter chips', () => {
  it('stays out of the way while the panel shows the same state', () => {
    useBrowseStore.getState().setCategory('kitchen');
    renderToolbar({ panelOpen: true });
    expect(screen.queryByTestId('community-category-chip')).toBeNull();
  });

  it('records a category filter and clears it', () => {
    renderToolbar();
    act(() => {
      useBrowseStore.getState().setCategory('kitchen');
    });
    expect(screen.getByTestId('community-category-chip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearCategoryFilter' }));
    expect(useBrowseStore.getState().filters.category).toBeNull();
  });

  it('records a technique filter and clears it', () => {
    renderToolbar();
    act(() => {
      useBrowseStore.getState().setTechnique(ALL_TECHNIQUES[0]);
    });
    expect(screen.getByTestId('community-technique-chip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearTechniqueFilter' }));
    expect(useBrowseStore.getState().filters.technique).toBeNull();
  });

  it('summarises the size constraints in one chip that clears every axis', () => {
    renderToolbar();
    act(() => {
      useBrowseStore.getState().setWidthMin(2);
      useBrowseStore.getState().setWidthMax(4);
      useBrowseStore.getState().setMaxHeight(6);
    });
    expect(screen.getByTestId('community-size-chip')).toHaveTextContent('2–4');
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearSizeFilter' }));
    const { filters } = useBrowseStore.getState();
    expect(filters.widthMin).toBeNull();
    expect(filters.widthMax).toBeNull();
    expect(filters.maxHeight).toBeNull();
  });

  it.each([
    ['community-liked-chip', 'likedOnly', () => useBrowseStore.getState().setLikedOnly(true)],
    ['community-recent-chip', 'recentOnly', () => useBrowseStore.getState().setRecentOnly(true)],
    ['community-mine-chip', 'mineOnly', () => useBrowseStore.getState().setMineOnly(true)],
  ] as const)('records the %s show toggle and clears it', (testId, key, activate) => {
    activate();
    renderToolbar();
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearNamedFilter' }));
    expect(useBrowseStore.getState().filters[key]).toBe(false);
  });

  it('shows the author chip with the display name and clears it via the X', () => {
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    renderToolbar();
    expect(screen.getByTestId('community-author-chip')).toHaveTextContent(
      'community.gallery.filteredByAuthor'
    );
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearAuthorFilter' }));
    expect(useBrowseStore.getState().filters.author).toBeNull();
  });

  it('shows a clearable featured chip while featuredOnly is active', () => {
    useBrowseStore.getState().setFeaturedOnly(true);
    renderToolbar();
    expect(screen.getByTestId('community-featured-chip')).toHaveTextContent(
      'community.shelves.featured'
    );
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFeaturedFilter' }));
    expect(useBrowseStore.getState().filters.featuredOnly).toBe(false);
  });

  it('shows the fits-gap chip with the gap size while the context is active', () => {
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2.5,
      depthMax: 3,
      maxHeight: 6,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    renderToolbar();
    // i18nEcho returns the key; the size rides in as interpolation params.
    expect(screen.getByTestId('community-fits-gap-chip')).toHaveTextContent(
      'community.gallery.fitsGapBanner'
    );
  });

  it('clearing the gap chip ends the context in both stores and restores normal browsing', () => {
    useGapFitStore.getState().setConstraint({
      maxWidth: gridUnits(2.5),
      maxDepth: gridUnits(3),
      maxHeight: heightUnits(6),
      gridUnitMm: 42 as Mm,
      gridUnitMmY: 42 as Mm,
      heightUnitMm: 7 as Mm,
      targetPosition: { x: gridUnits(0), y: gridUnits(0), layerId: layerId('layer_1') },
    });
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2.5,
      depthMax: 3,
      maxHeight: 6,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    useBrowseStore.getState().setSort('best-fit');
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFitsGap' }));

    expect(useBrowseStore.getState().fitsGapContext).toBeNull();
    expect(useGapFitStore.getState().constraint).toBeNull();
    // best-fit has nothing to score against once the gap clears, so the sort
    // falls back and browsing is fully back to normal.
    expect(useBrowseStore.getState().filters).toEqual(INITIAL_BROWSE_FILTERS);
    expect(screen.queryByTestId('community-fits-gap-chip')).not.toBeInTheDocument();
  });

  it('shows no chips and no clear-all while nothing is filtered', () => {
    renderToolbar();
    expect(screen.queryByTestId('community-category-chip')).toBeNull();
    expect(screen.queryByTestId('community-liked-chip')).toBeNull();
    expect(screen.queryByRole('button', { name: 'community.gallery.clearFilters' })).toBeNull();
  });

  it('clears every filter and the gap context from the chip row', () => {
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFilters' }));
    expect(useBrowseStore.getState().filters).toEqual(INITIAL_BROWSE_FILTERS);
  });

  it('renders the chips on mobile too', () => {
    responsiveMock.isMobile = true;
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    renderToolbar();
    expect(screen.getByTestId('community-author-chip')).toBeInTheDocument();
  });
});
