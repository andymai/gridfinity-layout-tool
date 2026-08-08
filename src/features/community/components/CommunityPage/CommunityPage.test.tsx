// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { CommunityCard } from '@/shared/types/community';
import { GALLERY_PAGE_SIZE, INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { CommunityPage } from './CommunityPage';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('../CommunityGalleryTab', () => ({
  GALLERY_RESULTS_ID: 'community-results',
  CommunityGalleryTab: ({
    surface,
    onFilterViewChange,
  }: {
    surface?: string;
    onFilterViewChange?: (open: boolean) => void;
  }) => (
    <div id="community-results" data-testid="gallery-stub" data-surface={surface ?? 'tab'}>
      <button type="button" onClick={() => onFilterViewChange?.(true)}>
        open-filter-view
      </button>
    </div>
  ),
}));

vi.mock('../CommunityDetail', () => ({
  CommunityDetail: ({ surface }: { surface?: string }) => (
    <div data-testid="detail-stub" data-surface={surface ?? 'tab'} />
  ),
}));

// App chrome, shared with every other surface and covered by its own tests.
vi.mock('@/shared/components/ToolSwitcher', () => ({
  ToolSwitcher: () => <div data-testid="tool-switcher-stub" />,
}));

vi.mock('@/shared/components/HeaderSupportLinks', () => ({
  HeaderSupportLinks: () => <div data-testid="support-links-stub" />,
}));

const DESIGN_ID = 'Abc123456789';

function card(id: string): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: `https://blob/${id}.webp`,
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
  };
}

function renderPage() {
  return render(
    <CommunityPage
      onRequestPublish={vi.fn(async () => true)}
      onRemixDesign={vi.fn(async () => true)}
      onEditOriginal={vi.fn(async () => 'opened' as const)}
    />
  );
}

function setCommunityFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
    },
  }));
}

/** Simulates the browser: back() pops to the gallery URL and fires a real popstate. */
function mockBackToGallery() {
  return vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.history.replaceState(null, '', '/community');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

let originalPathname: string;

beforeEach(() => {
  originalPathname = window.location.pathname;
  window.history.replaceState(null, '', '/community');
  localStorage.clear();
  setCommunityFlag(true);
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
  useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
  useSessionStore.setState({ status: 'anonymous', user: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  setCommunityFlag(false);
  useSessionStore.setState({ status: 'unknown', user: null });
  window.history.replaceState(null, '', originalPathname);
});

describe('CommunityPage', () => {
  it('renders the gallery on the route surface without a detail', () => {
    renderPage();
    expect(screen.getByTestId('gallery-stub')).toHaveAttribute('data-surface', 'route');
    expect(screen.queryByTestId('detail-stub')).not.toBeInTheDocument();
  });

  it('cold visit to /community/d/<id> opens the detail from the URL', async () => {
    window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
    renderPage();
    expect(await screen.findByTestId('detail-stub')).toHaveAttribute('data-surface', 'route');
    expect(useCommunityDetailStore.getState().request).toEqual({
      designId: DESIGN_ID,
      card: null,
    });
    expect(window.location.pathname).toBe(`/community/d/${DESIGN_ID}`);
  });

  it('cold visit resolves the card snapshot from the browse index when loaded', () => {
    useBrowseStore.setState({ status: 'ready', items: [card(DESIGN_ID)] });
    window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
    renderPage();
    expect(useCommunityDetailStore.getState().request?.card?.name).toBe(`Bin ${DESIGN_ID}`);
  });

  it('opening a card pushes the detail URL', async () => {
    renderPage();
    act(() => useCommunityDetailStore.getState().open(DESIGN_ID, card(DESIGN_ID)));
    expect(window.location.pathname).toBe(`/community/d/${DESIGN_ID}`);
    expect(window.history.state).toEqual({ communityRouteDetail: true });
    expect(await screen.findByTestId('detail-stub')).toBeInTheDocument();
  });

  it('browser Back closes the detail and returns to the gallery', () => {
    renderPage();
    act(() => useCommunityDetailStore.getState().open(DESIGN_ID, card(DESIGN_ID)));
    act(() => {
      window.history.replaceState(null, '', '/community');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(useCommunityDetailStore.getState().request).toBeNull();
    expect(screen.queryByTestId('detail-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('gallery-stub')).toBeInTheDocument();
  });

  it('browser Forward re-opens the detail from the URL', async () => {
    renderPage();
    act(() => {
      window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(useCommunityDetailStore.getState().request?.designId).toBe(DESIGN_ID);
    expect(await screen.findByTestId('detail-stub')).toBeInTheDocument();
  });

  it('UI close pops the pushed detail entry back to /community', () => {
    const backSpy = mockBackToGallery();
    renderPage();
    act(() => useCommunityDetailStore.getState().open(DESIGN_ID, card(DESIGN_ID)));
    act(() => useCommunityDetailStore.getState().close());
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/community');
    expect(screen.queryByTestId('detail-stub')).not.toBeInTheDocument();
  });

  it('UI close after a cold visit replaces the URL instead of leaving the site', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    window.history.replaceState(null, '', `/community/d/${DESIGN_ID}`);
    renderPage();
    act(() => useCommunityDetailStore.getState().close());
    expect(backSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/community');
    expect(screen.queryByTestId('detail-stub')).not.toBeInTheDocument();
  });

  describe('page chrome', () => {
    it('renders the app chrome instead of a back-to-app control', () => {
      renderPage();
      expect(screen.getByTestId('tool-switcher-stub')).toBeInTheDocument();
      expect(screen.queryByText('community.page.back')).not.toBeInTheDocument();
    });

    it('labels the surface as experimental', () => {
      renderPage();
      expect(screen.getByText('common.experimental')).toBeInTheDocument();
    });

    it('puts the gallery in a main landmark and leaves the h1 to the app shell', () => {
      const { container } = renderPage();
      const main = container.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.querySelector('[data-testid="gallery-stub"]')).not.toBeNull();
      // App renders the route-aware h1 for every surface; a second one here
      // made a screen reader announce the page title twice.
      expect(container.querySelector('h1')).toBeNull();
      expect(screen.getByRole('heading', { level: 2, name: 'community.page.title' })).toBeVisible();
    });

    it('stands the title row down while the mobile filter view has the screen', () => {
      renderPage();
      const titleRow = screen.getByTestId('community-page-title-row');
      expect(titleRow).not.toHaveAttribute('hidden');

      // The view replaces the grid entirely, so leaving the title, blurb and
      // CTA above it spent roughly a third of a phone screen on chrome the
      // user is not looking at.
      fireEvent.click(screen.getByText('open-filter-view'));
      expect(titleRow).toHaveAttribute('hidden');
    });

    it('offers a skip link past the filter rail to the results', () => {
      const { container } = renderPage();
      const skip = screen.getByRole('link', { name: 'community.page.skipToResults' });
      expect(skip).toHaveAttribute('href', '#community-results');
      // A skip link that lands nowhere is worse than none: it moves focus to
      // the document and the next Tab restarts from the top.
      expect(container.querySelector('#community-results')).not.toBeNull();
    });
  });

  describe('title row CTA', () => {
    it('offers to design a bin when the visitor has none saved', () => {
      const listener = vi.fn();
      const onRequestPublish = vi.fn(async () => true);
      window.addEventListener('switch-to-designer', listener);
      render(
        <CommunityPage
          onRequestPublish={onRequestPublish}
          onRemixDesign={vi.fn(async () => true)}
          onEditOriginal={vi.fn(async () => 'opened' as const)}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'community.page.designCta' }));

      expect(listener).toHaveBeenCalledTimes(1);
      // Nothing to publish, so the designer is the whole destination.
      expect(onRequestPublish).not.toHaveBeenCalled();
      window.removeEventListener('switch-to-designer', listener);
    });

    it('publishes the active design once the designer is mounted', () => {
      localStorage.setItem('gridfinity-designer-active-v1', 'design-1');
      const listener = vi.fn();
      const onRequestPublish = vi.fn(async () => true);
      window.addEventListener('switch-to-designer', listener);
      render(
        <CommunityPage
          onRequestPublish={onRequestPublish}
          onRemixDesign={vi.fn(async () => true)}
          onEditOriginal={vi.fn(async () => 'opened' as const)}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'community.page.publishCta' }));

      // Order matters: the publish dialog captures from the designer's live
      // mesh, which only exists once the designer route is mounted.
      expect(listener).toHaveBeenCalledTimes(1);
      expect(onRequestPublish).toHaveBeenCalledTimes(1);
      window.removeEventListener('switch-to-designer', listener);
    });
  });

  describe('shareable filter state', () => {
    it('cold visit applies every filter the query carries', () => {
      window.history.replaceState(null, '', '/community?q=hex&cat=tools&sort=prints&w=2-4&liked=1');
      renderPage();
      const { filters } = useBrowseStore.getState();
      expect(filters.searchText).toBe('hex');
      expect(filters.category).toBe('tools');
      expect(filters.sort).toBe('prints');
      expect(filters.widthMin).toBe(2);
      expect(filters.widthMax).toBe(4);
      expect(filters.likedOnly).toBe(true);
    });

    it('narrowing the gallery writes the query in place', () => {
      renderPage();
      act(() => {
        useBrowseStore.getState().setCategory('kitchen');
        useBrowseStore.getState().setSearchText('bit');
      });
      expect(window.location.pathname).toBe('/community');
      expect(window.location.search).toBe('?q=bit&cat=kitchen');
    });

    it('clearing every filter leaves a bare /community', () => {
      window.history.replaceState(null, '', '/community?cat=tools&liked=1');
      renderPage();
      act(() => {
        useBrowseStore.getState().clearFilters();
      });
      expect(window.location.search).toBe('');
    });

    it('never pushes a history entry for a filter change', () => {
      // Narrowing is not navigation: pushing would mean a Back press per
      // filter tweak just to leave the page.
      renderPage();
      const pushSpy = vi.spyOn(window.history, 'pushState');
      act(() => {
        useBrowseStore.getState().setCategory('tools');
        useBrowseStore.getState().setCategory('kitchen');
        useBrowseStore.getState().setLikedOnly(true);
      });
      expect(pushSpy).not.toHaveBeenCalled();
      expect(window.location.search).toBe('?cat=kitchen&liked=1');
    });

    it('opening a detail does not clear the gallery underneath it', () => {
      // A detail URL carries no query, so the reader has to stand down while
      // one owns the path: applying its empty query would wipe the filters
      // behind the overlay and reset the paging Back is meant to return to.
      window.history.replaceState(null, '', '/community?q=hex&cat=tools');
      renderPage();
      act(() => {
        useBrowseStore.getState().showMore();
      });
      const pagedTo = useBrowseStore.getState().visibleCount;

      act(() => {
        useCommunityDetailStore.getState().open('DesignAAAAAA');
      });
      const during = useBrowseStore.getState();
      expect(during.filters.searchText).toBe('hex');
      expect(during.filters.category).toBe('tools');
      expect(during.visibleCount).toBe(pagedTo);
    });

    it('returning from a detail replays the same query without resetting paging', () => {
      window.history.replaceState(null, '', '/community?q=hex');
      renderPage();
      act(() => {
        useBrowseStore.getState().showMore();
      });
      const pagedTo = useBrowseStore.getState().visibleCount;

      act(() => {
        window.history.replaceState(null, '', '/community?q=hex');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      // The replay is a no-op, so it must not count as a filter change: those
      // legitimately reset scroll and page count, and Back is not one.
      expect(useBrowseStore.getState().visibleCount).toBe(pagedTo);
      expect(useBrowseStore.getState().filters.searchText).toBe('hex');
    });

    it('a query that really changes still resets paging', () => {
      window.history.replaceState(null, '', '/community?q=hex');
      renderPage();
      act(() => {
        useBrowseStore.getState().showMore();
      });
      expect(useBrowseStore.getState().visibleCount).toBeGreaterThan(GALLERY_PAGE_SIZE);
      act(() => {
        window.history.replaceState(null, '', '/community?q=bit');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(useBrowseStore.getState().visibleCount).toBe(GALLERY_PAGE_SIZE);
    });

    it('leaves the layout editor gap context out of the URL', () => {
      // It describes a gap in the sender's drawer and means nothing in a
      // recipient's browser.
      renderPage();
      act(() => {
        useBrowseStore.getState().setFitsGapContext({
          widthMax: 3,
          depthMax: 2,
          maxHeight: 6,
          gridUnitMm: 42,
          gridUnitMmY: 42,
          heightUnitMm: 7,
        });
      });
      expect(window.location.search).toBe('');
    });

    it('a shared link does not clear the viewer’s own Mine view', () => {
      // mineOnly is resolved per account, so the URL neither carries nor
      // clears it.
      renderPage();
      act(() => {
        useBrowseStore.getState().setMineOnly(true);
      });
      expect(window.location.search).toBe('');
      act(() => {
        window.history.replaceState(null, '', '/community?cat=tools');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(useBrowseStore.getState().filters.mineOnly).toBe(true);
      expect(useBrowseStore.getState().filters.category).toBe('tools');
    });

    const AUTHOR_ID = 'a'.repeat(32);

    function authorCard(id: string): CommunityCard {
      return { ...card(id), authorPublicId: AUTHOR_ID, authorName: 'Alice' };
    }

    it('cold visit applies the author filter from the URL and resolves the display name', () => {
      useBrowseStore.setState({ status: 'ready', items: [authorCard('DesignAAAAAA')] });
      window.history.replaceState(null, '', `/community?author=${AUTHOR_ID}`);
      renderPage();
      expect(useBrowseStore.getState().filters.author).toEqual({
        id: AUTHOR_ID,
        name: 'Alice',
      });
    });

    it('cold visit before the index loads stores the id and resolves the name later', () => {
      window.history.replaceState(null, '', `/community?author=${AUTHOR_ID}`);
      renderPage();
      expect(useBrowseStore.getState().filters.author).toEqual({ id: AUTHOR_ID, name: '' });
      act(() => {
        useBrowseStore.setState({ status: 'ready', items: [authorCard('DesignAAAAAA')] });
      });
      expect(useBrowseStore.getState().filters.author).toEqual({
        id: AUTHOR_ID,
        name: 'Alice',
      });
    });

    it('applying the author filter writes the shareable query param in place', () => {
      renderPage();
      act(() => {
        useBrowseStore.getState().setAuthor({ id: AUTHOR_ID, name: 'Alice' });
      });
      expect(window.location.pathname).toBe('/community');
      expect(window.location.search).toBe(`?author=${AUTHOR_ID}`);
    });

    it('clearing the author filter removes the query param', () => {
      window.history.replaceState(null, '', `/community?author=${AUTHOR_ID}`);
      renderPage();
      act(() => {
        useBrowseStore.getState().setAuthor(null);
      });
      expect(window.location.search).toBe('');
    });

    it('an invalid author value is ignored', () => {
      window.history.replaceState(null, '', '/community?author=not-valid');
      renderPage();
      expect(useBrowseStore.getState().filters.author).toBeNull();
    });
  });
});
