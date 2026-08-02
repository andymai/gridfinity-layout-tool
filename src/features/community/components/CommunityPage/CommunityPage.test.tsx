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
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { CommunityPage } from './CommunityPage';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../CommunityGalleryTab', () => ({
  CommunityGalleryTab: ({ surface }: { surface?: string }) => (
    <div data-testid="gallery-stub" data-surface={surface ?? 'tab'} />
  ),
}));

vi.mock('../CommunityDetail', () => ({
  CommunityDetail: ({ surface }: { surface?: string }) => (
    <div data-testid="detail-stub" data-surface={surface ?? 'tab'} />
  ),
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

  describe('visitor strip', () => {
    it('shows for signed-out visitors without local designs', () => {
      renderPage();
      expect(screen.getByTestId('community-visitor-strip')).toBeInTheDocument();
    });

    it('CTA dispatches switch-to-designer', () => {
      const listener = vi.fn();
      window.addEventListener('switch-to-designer', listener);
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'community.page.strip.cta' }));
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener('switch-to-designer', listener);
    });

    it('hides when signed in', () => {
      useSessionStore.setState({
        status: 'authenticated',
        user: { userId: 'u1', provider: 'github', email: 'andy@example.com' },
      });
      renderPage();
      expect(screen.queryByTestId('community-visitor-strip')).not.toBeInTheDocument();
    });

    it('hides while the session is still resolving', () => {
      useSessionStore.setState({ status: 'unknown', user: null });
      renderPage();
      expect(screen.queryByTestId('community-visitor-strip')).not.toBeInTheDocument();
    });

    it('hides when the visitor already has local designs', () => {
      localStorage.setItem('gridfinity-designer-active-v1', 'design-1');
      renderPage();
      expect(screen.queryByTestId('community-visitor-strip')).not.toBeInTheDocument();
    });

    it('dismiss hides it and persists across visits', () => {
      const { unmount } = renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'community.page.strip.dismiss' }));
      expect(screen.queryByTestId('community-visitor-strip')).not.toBeInTheDocument();
      unmount();
      renderPage();
      expect(screen.queryByTestId('community-visitor-strip')).not.toBeInTheDocument();
    });
  });

  describe('shareable author view (?author=)', () => {
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
