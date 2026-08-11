// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityCard } from '@/shared/types/community';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { ShelfLanding } from './ShelfLanding';
import { MAX_LANDING_RAILS, SHELF_LANDING_MIN_DESIGNS } from './shelfData';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// The shipped list is empty on purpose; these drive it directly so the
// mechanism is covered without committing editorial picks.
const collections = vi.hoisted(() => ({ COMMUNITY_COLLECTIONS: [] as unknown[] }));
vi.mock('../../data/collections', () => collections);

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

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

function manyCards(
  count: number,
  overrides: (index: number) => Partial<CommunityCard> = () => ({})
): CommunityCard[] {
  return Array.from({ length: count }, (_, i) =>
    card(`design${String(i).padStart(3, '0')}`, { createdAt: 1000 + i, ...overrides(i) })
  );
}

beforeEach(() => {
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
});

describe('ShelfLanding', () => {
  it('renders nothing below the landing threshold', () => {
    render(
      <ShelfLanding
        items={manyCards(SHELF_LANDING_MIN_DESIGNS - 1)}
        onSelect={vi.fn()}
        onSelectAuthor={vi.fn()}
      />
    );
    expect(screen.queryByTestId('community-shelves')).not.toBeInTheDocument();
  });

  it('renders shelf sections with accessible headings and cards', () => {
    render(
      <ShelfLanding
        items={manyCards(20, (i) => ({ featured: i >= 3 && i < 6 }))}
        onSelect={vi.fn()}
        onSelectAuthor={vi.fn()}
      />
    );
    expect(screen.getByText('community.shelves.featured')).toBeInTheDocument();
    expect(screen.getByText('community.shelves.newThisWeek')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'community.shelves.featured' })).toBeInTheDocument();
    expect(screen.getByText('Bin design003')).toBeInTheDocument();
  });

  it('disables snap scrolling under reduced motion via the motion-reduce classes', () => {
    render(<ShelfLanding items={manyCards(12)} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);
    const rail = screen.getByRole('list', { name: 'community.shelves.newThisWeek' });
    expect(rail.className).toContain('snap-x');
    expect(rail.className).toContain('motion-reduce:snap-none');
    expect(rail.className).toContain('motion-reduce:scroll-auto');
    expect(rail.className).toContain('overflow-x-auto');
  });

  it('see all on staff picks applies the featured-only filter', () => {
    render(
      <ShelfLanding
        items={manyCards(12, (i) => ({ featured: i < 3 }))}
        onSelect={vi.fn()}
        onSelectAuthor={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('community-shelf-see-all-featured'));
    const { filters } = useBrowseStore.getState();
    expect(filters.featuredOnly).toBe(true);
    expect(filters.sort).toBe('newest');
  });

  it('new this week has no see-all button (the grid below is already newest-first)', () => {
    render(<ShelfLanding items={manyCards(12)} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);
    expect(screen.getByText('community.shelves.newThisWeek')).toBeInTheDocument();
    expect(screen.queryByTestId('community-shelf-see-all-new-this-week')).not.toBeInTheDocument();
  });

  it('see-all buttons use the per-shelf label key', () => {
    // A real clock, so the 1000-era createdAt values fall outside the
    // new-this-week window and the remixed cards reach most-remixed instead
    // of being consumed by recency.
    useBrowseStore.setState({ fetchedAt: 30 * 24 * 60 * 60 * 1000 });
    render(
      <ShelfLanding
        items={manyCards(12, (i) => ({
          featured: i < 3,
          counts: { likes: 0, remixes: i >= 3 && i < 6 ? 2 : 0, exports: 0 },
        }))}
        onSelect={vi.fn()}
        onSelectAuthor={vi.fn()}
      />
    );
    // The visible label is the same short string on every shelf; the shelf
    // name lives in the accessible name, which is what distinguishes them.
    expect(screen.getByTestId('community-shelf-see-all-featured').textContent).toBe(
      'community.shelves.seeAll'
    );
    expect(screen.getByTestId('community-shelf-see-all-most-remixed').textContent).toBe(
      'community.shelves.seeAll'
    );
  });

  it('see all on most remixed applies the remixes sort', () => {
    render(
      <ShelfLanding
        items={manyCards(12, () => ({ counts: { likes: 0, remixes: 2, exports: 0 } }))}
        onSelect={vi.fn()}
        onSelectAuthor={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('community-shelf-see-all-most-remixed'));
    expect(useBrowseStore.getState().filters.sort).toBe('remixes');
  });

  it('caps the landing so the grid stays about one flick away', () => {
    // Enough signal for all four derived shelves to qualify: featured,
    // printed, new-this-week (fetchedAt is 0, so every card is inside the
    // window) and most-remixed.
    render(
      <ShelfLanding
        items={manyCards(24, (i) => ({
          featured: i < 3,
          counts: {
            likes: 0,
            remixes: i >= 12 ? 5 : 0,
            exports: 0,
            prints: i >= 3 && i < 6 ? 2 : 0,
          },
        }))}
        onSelect={vi.fn()}
        onSelectAuthor={vi.fn()}
      />
    );
    expect(screen.getAllByRole('list')).toHaveLength(MAX_LANDING_RAILS);
    expect(screen.getByText('community.shelves.featured')).toBeInTheDocument();
    expect(screen.getByText('community.shelves.proven')).toBeInTheDocument();
    expect(screen.getByText('community.shelves.newThisWeek')).toBeInTheDocument();
    // Dropped, not lost: its cards are all in the grid below, and its own
    // sort is still one click away in the results header.
    expect(screen.queryByText('community.shelves.mostRemixed')).not.toBeInTheDocument();
  });

  it('shelf cards select through the shared handler', () => {
    const onSelect = vi.fn();
    render(<ShelfLanding items={manyCards(12)} onSelect={onSelect} onSelectAuthor={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('link', { name: /Bin design011/ })[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'design011' }));
  });

  describe('curated collections', () => {
    it('renders a curated shelf above the derived ones', () => {
      collections.COMMUNITY_COLLECTIONS = [
        {
          id: 'starters',
          titleKey: 'collections.starters.title',
          blurbKey: 'collections.starters.blurb',
          designIds: ['design000'],
        },
      ];
      const items = manyCards(SHELF_LANDING_MIN_DESIGNS);
      render(<ShelfLanding items={items} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);

      const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      // A human vouched for these, which outranks any derived shelf.
      expect(headings[0]).toBe('collections.starters.title');
      expect(screen.getByText('collections.starters.blurb')).toBeInTheDocument();
    });

    it('drops a curated shelf whose designs are all gone', () => {
      collections.COMMUNITY_COLLECTIONS = [
        {
          id: 'ghosts',
          titleKey: 'collections.ghosts.title',
          blurbKey: 'collections.ghosts.blurb',
          designIds: ['not-published'],
        },
      ];
      const items = manyCards(SHELF_LANDING_MIN_DESIGNS);
      render(<ShelfLanding items={items} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);

      // An empty shelf advertises a grouping then fails to deliver it.
      expect(screen.queryByText('collections.ghosts.title')).toBeNull();
    });

    it('gives a curated shelf no see-all, since it is not a filter', () => {
      collections.COMMUNITY_COLLECTIONS = [
        {
          id: 'starters',
          titleKey: 'collections.starters.title',
          blurbKey: 'collections.starters.blurb',
          designIds: ['design000'],
        },
      ];
      const items = manyCards(SHELF_LANDING_MIN_DESIGNS);
      render(<ShelfLanding items={items} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);

      expect(screen.queryByTestId('community-shelf-see-all-collection-starters')).toBeNull();
    });
  });

  describe('scroll affordance', () => {
    function stubRail({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
      // jsdom lays nothing out, so the rail has to be told it overflows.
      Object.defineProperty(HTMLUListElement.prototype, 'scrollWidth', {
        value: scrollWidth,
        configurable: true,
      });
      Object.defineProperty(HTMLUListElement.prototype, 'clientWidth', {
        value: clientWidth,
        configurable: true,
      });
    }

    afterEach(() => {
      Reflect.deleteProperty(HTMLUListElement.prototype, 'scrollWidth');
      Reflect.deleteProperty(HTMLUListElement.prototype, 'clientWidth');
    });

    it('offers no affordance while the rail fits', () => {
      stubRail({ scrollWidth: 400, clientWidth: 400 });
      render(<ShelfLanding items={manyCards(12)} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);
      expect(screen.queryByTestId('community-shelf-fade-end')).not.toBeInTheDocument();
      expect(screen.queryByTestId('community-shelf-fade-start')).not.toBeInTheDocument();
    });

    it('marks only the trailing edge before the rail is scrolled', () => {
      stubRail({ scrollWidth: 1600, clientWidth: 400 });
      render(<ShelfLanding items={manyCards(12)} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);
      expect(screen.getAllByTestId('community-shelf-fade-end').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('community-shelf-fade-start')).not.toBeInTheDocument();
    });

    it('scrolls the rail from its forward button', () => {
      stubRail({ scrollWidth: 1600, clientWidth: 400 });
      const scrollBy = vi.fn();
      Object.defineProperty(HTMLUListElement.prototype, 'scrollBy', {
        value: scrollBy,
        configurable: true,
      });

      render(<ShelfLanding items={manyCards(12)} onSelect={vi.fn()} onSelectAuthor={vi.fn()} />);
      fireEvent.click(screen.getAllByRole('button', { name: /scrollForward/ })[0]);

      expect(scrollBy).toHaveBeenCalledWith(
        expect.objectContaining({ left: expect.any(Number), behavior: 'smooth' })
      );
      Reflect.deleteProperty(HTMLUListElement.prototype, 'scrollBy');
    });
  });
});
