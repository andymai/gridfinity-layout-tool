// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useGapFitStore } from '@/core/store/gapFit';
import type { CommunityCard } from '@/shared/types/community';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { FilterPanel } from './FilterPanel';
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

const ITEMS = [
  card('a', { category: 'hardware' }),
  card('b', { category: 'hardware' }),
  card('c', { category: 'kitchen', likedByMe: true, featured: true }),
];

function renderPanel(items: readonly CommunityCard[] = ITEMS) {
  const counts = computeFacetCounts({
    items,
    filters: useBrowseStore.getState().filters,
    recentIds: [],
    fitsGapContext: useBrowseStore.getState().fitsGapContext,
  });
  return render(<FilterPanel items={items} counts={counts} />);
}

function signIn(): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'u1', provider: 'github', email: 'andy@example.com' },
  });
}

beforeEach(() => {
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: ITEMS });
  useGapFitStore.setState({ constraint: null });
  useSessionStore.setState({ status: 'anonymous', user: null });
});

afterEach(() => {
  useSessionStore.setState({ status: 'unknown', user: null });
});

describe('FilterPanel show toggles', () => {
  it('opens the sign-in prompt instead of filtering for anonymous visitors', () => {
    renderPanel();
    const liked = screen.getByTestId('community-filter-liked');
    expect(liked).toBeEnabled();
    fireEvent.click(liked);
    expect(useBrowseStore.getState().filters.likedOnly).toBe(false);
    expect(screen.getByText('community.gallery.likedFilterSignedOut')).toBeInTheDocument();
  });

  it('toggles likedOnly for a signed-in user', () => {
    signIn();
    renderPanel();
    const liked = screen.getByTestId('community-filter-liked');
    expect(liked).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(liked);
    expect(useBrowseStore.getState().filters.likedOnly).toBe(true);
    expect(screen.getByTestId('community-filter-liked')).toHaveAttribute('aria-checked', 'true');
  });

  it('hides My designs from signed-out visitors', () => {
    renderPanel();
    expect(screen.queryByTestId('community-filter-mine')).toBeNull();
    signIn();
    renderPanel();
    expect(screen.getAllByTestId('community-filter-mine')[0]).toBeInTheDocument();
  });

  it('toggles recently viewed and staff picks', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('community-filter-recent'));
    expect(useBrowseStore.getState().filters.recentOnly).toBe(true);
    fireEvent.click(screen.getByTestId('community-filter-featured'));
    expect(useBrowseStore.getState().filters.featuredOnly).toBe(true);
  });

  it('leaves My designs uncounted, since it swaps the card source', () => {
    signIn();
    renderPanel();
    expect(screen.getByTestId('community-filter-mine')).not.toHaveTextContent(/\d/);
  });

  it('shows how many designs each toggle would leave', () => {
    renderPanel();
    // One liked card, one featured card in the fixture.
    expect(screen.getByTestId('community-filter-liked')).toHaveTextContent('1');
    expect(screen.getByTestId('community-filter-featured')).toHaveTextContent('1');
  });
});

describe('FilterPanel category facet', () => {
  it('counts each category under the other active filters', () => {
    renderPanel();
    expect(screen.getByTestId('community-filter-category-hardware')).toHaveTextContent('2');
    expect(screen.getByTestId('community-filter-category-kitchen')).toHaveTextContent('1');
  });

  it('promises the unfiltered total on the All row, not the narrowed one', () => {
    useBrowseStore.getState().setCategory('kitchen');
    renderPanel();
    expect(screen.getByTestId('community-filter-category-all')).toHaveTextContent('3');
  });

  it('selects a category and deselects it on reselect', () => {
    renderPanel();
    const kitchen = screen.getByTestId('community-filter-category-kitchen');
    fireEvent.click(kitchen);
    expect(useBrowseStore.getState().filters.category).toBe('kitchen');
    renderPanel();
    fireEvent.click(screen.getAllByTestId('community-filter-category-kitchen')[1]);
    expect(useBrowseStore.getState().filters.category).toBeNull();
  });

  it('disables a category that would empty the grid', () => {
    renderPanel();
    // Nothing in the fixture is in "office".
    expect(screen.getByTestId('community-filter-category-office')).toBeDisabled();
  });

  it('keeps the selected category clickable even at zero', () => {
    useBrowseStore.getState().setCategory('office');
    renderPanel();
    const office = screen.getByTestId('community-filter-category-office');
    expect(office).toBeEnabled();
    fireEvent.click(office);
    expect(useBrowseStore.getState().filters.category).toBeNull();
  });

  it('clears the category from the All row', () => {
    useBrowseStore.getState().setCategory('kitchen');
    renderPanel();
    fireEvent.click(screen.getByTestId('community-filter-category-all'));
    expect(useBrowseStore.getState().filters.category).toBeNull();
  });
});

describe('FilterPanel viewing context', () => {
  it('stays hidden until an author or gap context arrives', () => {
    renderPanel();
    expect(screen.queryByTestId('community-viewing-author')).toBeNull();
    expect(screen.queryByTestId('community-viewing-fits-gap')).toBeNull();
  });

  it('pins the author view above the chosen filters and clears it', () => {
    useBrowseStore.getState().setAuthor({ id: 'a'.repeat(32), name: 'Alice' });
    renderPanel();
    expect(screen.getByTestId('community-viewing-author')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearAuthorFilter' }));
    expect(useBrowseStore.getState().filters.author).toBeNull();
  });

  it('clears the gap context out of both stores', () => {
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2,
      depthMax: 3,
      maxHeight: null,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    renderPanel();
    expect(screen.getByTestId('community-viewing-fits-gap')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearFitsGap' }));
    expect(useBrowseStore.getState().fitsGapContext).toBeNull();
    expect(useGapFitStore.getState().constraint).toBeNull();
  });
});

describe('FilterPanel clear all', () => {
  it('is inert while nothing is filtered', () => {
    renderPanel();
    expect(screen.getByTestId('community-filter-clear-all')).toBeDisabled();
  });

  it('clears the filters and the gap context together', () => {
    useBrowseStore.getState().setCategory('kitchen');
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2,
      depthMax: 3,
      maxHeight: null,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    renderPanel();
    fireEvent.click(screen.getByTestId('community-filter-clear-all'));
    expect(useBrowseStore.getState().filters.category).toBeNull();
    expect(useBrowseStore.getState().fitsGapContext).toBeNull();
  });
});

describe('FilterPanel sections', () => {
  it('gathers every narrowing control into one panel', () => {
    renderPanel();
    expect(screen.getByText('community.gallery.showSection')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.categoryLabel')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.sizeLabel')).toBeInTheDocument();
    expect(screen.getByTestId('community-size-filters')).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: 'community.gallery.techniqueLabel' })
    ).toBeInTheDocument();
  });
});
