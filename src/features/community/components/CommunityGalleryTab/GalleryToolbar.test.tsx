// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useGapFitStore } from '@/core/store/gapFit';
import { gridUnits, heightUnits, layerId } from '@/core/types';
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

function signIn(): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'u1', provider: 'github', email: 'andy@example.com' },
  });
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

describe('GalleryToolbar (desktop)', () => {
  it('renders search, the full technique pill enum, category, and sort controls', () => {
    render(<GalleryToolbar />);
    expect(screen.getByLabelText('community.gallery.searchLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.categoryLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.sortLabel')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(ALL_TECHNIQUES.length + 1);
    expect(screen.queryByRole('button', { name: /community.gallery.filters/ })).toBeNull();
  });

  it('writes search text to the browse store and clears it via the clear button', () => {
    render(<GalleryToolbar />);
    const search = screen.getByLabelText('community.gallery.searchLabel');
    fireEvent.change(search, { target: { value: 'screws' } });
    expect(useBrowseStore.getState().filters.searchText).toBe('screws');
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearSearch' }));
    expect(useBrowseStore.getState().filters.searchText).toBe('');
  });

  it('updates category and sort filters', () => {
    render(<GalleryToolbar />);
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'kitchen' },
    });
    expect(useBrowseStore.getState().filters.category).toBe('kitchen');
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'all' },
    });
    expect(useBrowseStore.getState().filters.category).toBeNull();
    fireEvent.change(screen.getByLabelText('community.gallery.sortLabel'), {
      target: { value: 'likes' },
    });
    expect(useBrowseStore.getState().filters.sort).toBe('likes');
  });

  it('selects a technique pill and toggles it off on reselect', () => {
    render(<GalleryToolbar />);
    const pill = screen.getAllByRole('radio')[1];
    fireEvent.click(pill);
    expect(useBrowseStore.getState().filters.technique).toBe(ALL_TECHNIQUES[0]);
    fireEvent.click(pill);
    expect(useBrowseStore.getState().filters.technique).toBeNull();
  });

  it('renders the dimension filter row on desktop', () => {
    render(<GalleryToolbar />);
    expect(screen.getByTestId('community-dimension-filters')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.widthMinLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.maxHeightLabel')).toBeInTheDocument();
  });

  it('offers best-fit only while a dimension constraint is active', () => {
    render(<GalleryToolbar />);
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
    useBrowseStore.getState().setFitsGapContext({ widthMax: 2, depthMax: 3, maxHeight: null });
    render(<GalleryToolbar />);
    const sortSelect = screen.getByLabelText('community.gallery.sortLabel');
    expect(Array.from(sortSelect.querySelectorAll('option')).map((o) => o.value)).toContain(
      'best-fit'
    );
  });

  it('counts dimension filters toward the clear-filters affordance', () => {
    render(<GalleryToolbar />);
    expect(screen.queryByRole('button', { name: 'community.gallery.clearFilters' })).toBeNull();
    act(() => {
      useBrowseStore.getState().setMaxHeight(6);
    });
    expect(
      screen.getByRole('button', { name: 'community.gallery.clearFilters' })
    ).toBeInTheDocument();
  });

  it('shows a clear-filters button only when a filter is active', () => {
    render(<GalleryToolbar />);
    expect(screen.queryByRole('button', { name: 'community.gallery.clearFilters' })).toBeNull();
    fireEvent.change(screen.getByLabelText('community.gallery.categoryLabel'), {
      target: { value: 'tools' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFilters' }));
    expect(useBrowseStore.getState().filters.category).toBeNull();
    expect(screen.queryByRole('button', { name: 'community.gallery.clearFilters' })).toBeNull();
  });
});

describe('GalleryToolbar filter chips', () => {
  it('opens the sign-in prompt instead of filtering for anonymous visitors', () => {
    // A disabled chip with only a title tooltip is an unexplained dead
    // control on touch devices; the chip stays enabled and explains itself.
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-liked-chip');
    expect(chip).toBeEnabled();
    fireEvent.click(chip);
    expect(useBrowseStore.getState().filters.likedOnly).toBe(false);
    expect(screen.getByText('community.gallery.likedFilterSignedOut')).toBeInTheDocument();
    expect(screen.getByText('auth.signInWithGoogle')).toBeInTheDocument();
  });

  it('toggles likedOnly for a signed-in user', () => {
    signIn();
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-liked-chip');
    expect(chip).toBeEnabled();
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(useBrowseStore.getState().filters.likedOnly).toBe(true);
    expect(screen.getByTestId('community-liked-chip')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('community-liked-chip'));
    expect(useBrowseStore.getState().filters.likedOnly).toBe(false);
  });

  it('does not render the Mine chip for signed-out visitors', () => {
    // Unlike Liked there is no sign-in prompt branch: a signed-out visitor
    // structurally has no published designs.
    render(<GalleryToolbar />);
    expect(screen.queryByTestId('community-mine-chip')).not.toBeInTheDocument();
  });

  it('toggles mineOnly for a signed-in user', () => {
    signIn();
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-mine-chip');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(useBrowseStore.getState().filters.mineOnly).toBe(true);
    expect(screen.getByTestId('community-mine-chip')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('community-mine-chip'));
    expect(useBrowseStore.getState().filters.mineOnly).toBe(false);
  });

  it('counts mineOnly toward the clear-filters affordance', () => {
    signIn();
    render(<GalleryToolbar />);
    fireEvent.click(screen.getByTestId('community-mine-chip'));
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFilters' }));
    expect(useBrowseStore.getState().filters.mineOnly).toBe(false);
  });

  it('toggles recentOnly regardless of session (local-only feature)', () => {
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-recent-chip');
    expect(chip).toBeEnabled();
    fireEvent.click(chip);
    expect(useBrowseStore.getState().filters.recentOnly).toBe(true);
    fireEvent.click(screen.getByTestId('community-recent-chip'));
    expect(useBrowseStore.getState().filters.recentOnly).toBe(false);
  });

  it('shows the author chip with the display name and clears it via the X', () => {
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-author-chip');
    expect(chip).toHaveTextContent('community.gallery.filteredByAuthor');
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearAuthorFilter' }));
    expect(useBrowseStore.getState().filters.author).toBeNull();
    expect(screen.queryByTestId('community-author-chip')).not.toBeInTheDocument();
  });

  it('hides the author chip when no author filter is active', () => {
    render(<GalleryToolbar />);
    expect(screen.queryByTestId('community-author-chip')).not.toBeInTheDocument();
  });

  it('shows the fits-gap banner with the gap size while the context is active', () => {
    useBrowseStore.getState().setFitsGapContext({ widthMax: 2.5, depthMax: 3, maxHeight: 6 });
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-fits-gap-chip');
    // i18nEcho returns the key; the size rides in as interpolation params.
    expect(chip).toHaveTextContent('community.gallery.fitsGapBanner');
    expect(screen.getByRole('button', { name: 'community.gallery.clearFitsGap' })).toBeEnabled();
  });

  it('clearing the banner ends the fits-gap context in both stores and restores normal browsing', () => {
    useGapFitStore.getState().setConstraint({
      maxWidth: gridUnits(2.5),
      maxDepth: gridUnits(3),
      maxHeight: heightUnits(6),
      targetPosition: { x: gridUnits(0), y: gridUnits(0), layerId: layerId('layer_1') },
    });
    useBrowseStore.getState().setFitsGapContext({ widthMax: 2.5, depthMax: 3, maxHeight: 6 });
    useBrowseStore.getState().setSort('best-fit');
    render(<GalleryToolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFitsGap' }));

    expect(useBrowseStore.getState().fitsGapContext).toBeNull();
    expect(useGapFitStore.getState().constraint).toBeNull();
    // best-fit has nothing to score against once the gap clears, so the sort
    // falls back and browsing is fully back to normal.
    expect(useBrowseStore.getState().filters.sort).toBe('newest');
    expect(useBrowseStore.getState().filters).toEqual(INITIAL_BROWSE_FILTERS);
    expect(screen.queryByTestId('community-fits-gap-chip')).not.toBeInTheDocument();
  });

  it('hides the fits-gap banner when no gap context is active', () => {
    render(<GalleryToolbar />);
    expect(screen.queryByTestId('community-fits-gap-chip')).not.toBeInTheDocument();
  });

  it('shows a clearable staff-picks chip while featuredOnly is active', () => {
    useBrowseStore.getState().setFeaturedOnly(true);
    render(<GalleryToolbar />);
    const chip = screen.getByTestId('community-featured-chip');
    expect(chip).toHaveTextContent('community.shelves.staffPicks');
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFeaturedFilter' }));
    expect(useBrowseStore.getState().filters.featuredOnly).toBe(false);
    expect(screen.queryByTestId('community-featured-chip')).not.toBeInTheDocument();
  });

  it('hides the staff-picks chip while featuredOnly is off', () => {
    render(<GalleryToolbar />);
    expect(screen.queryByTestId('community-featured-chip')).not.toBeInTheDocument();
  });

  it('counts the new filters toward the clear-filters affordance', () => {
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    render(<GalleryToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFilters' }));
    expect(useBrowseStore.getState().filters.author).toBeNull();
  });

  it('renders the chips on mobile too', () => {
    responsiveMock.isMobile = true;
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    render(<GalleryToolbar />);
    expect(screen.getByTestId('community-liked-chip')).toBeInTheDocument();
    expect(screen.getByTestId('community-recent-chip')).toBeInTheDocument();
    expect(screen.getByTestId('community-author-chip')).toBeInTheDocument();
  });
});

describe('GalleryToolbar (mobile)', () => {
  beforeEach(() => {
    responsiveMock.isMobile = true;
  });

  it('renders one row with search, compact sort, and a filter button; no inline pills', () => {
    render(<GalleryToolbar />);
    expect(screen.getByLabelText('community.gallery.searchLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('community.gallery.sortLabel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /community.gallery.filters/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('community.gallery.categoryLabel')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('badges the filter button with the active filter count', () => {
    useBrowseStore.getState().setCategory('tools');
    useBrowseStore.getState().setTechnique('scoop');
    render(<GalleryToolbar />);
    expect(screen.getByText('community.gallery.activeFilterCount')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('counts each active dimension filter in the badge', () => {
    useBrowseStore.getState().setWidthMin(1);
    useBrowseStore.getState().setWidthMax(2);
    useBrowseStore.getState().setDepthMax(3);
    useBrowseStore.getState().setMaxHeight(6);
    render(<GalleryToolbar />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('opens the filter sheet from the filter button', () => {
    render(<GalleryToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /community.gallery.filters/ }));
    expect(screen.getByText('community.gallery.filterSheetTitle')).toBeInTheDocument();
  });
});
