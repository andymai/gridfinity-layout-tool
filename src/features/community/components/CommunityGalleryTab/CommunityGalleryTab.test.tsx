// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { trackEvent } from '@/shared/analytics/posthog';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import { useToastStore } from '@/core/store/toast';
import type { CommunityCard } from '@/shared/types/community';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useGapFitStore } from '@/core/store/gapFit';
import { gridUnits, heightUnits, layerId } from '@/core/types';
import type { Mm } from '@/core/types';
import { fetchCommunityIndex, fetchMineIndex } from '../../api/client';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { INITIAL_MINE_STATE, useMineStore } from '../../store/mineStore';
import { CommunityGalleryTab, GALLERY_PAGE_SIZE } from './CommunityGalleryTab';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, fetchCommunityIndex: vi.fn(), fetchMineIndex: vi.fn() };
});

const indexMock = vi.mocked(fetchCommunityIndex);
const mineIndexMock = vi.mocked(fetchMineIndex);

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
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
    ...overrides,
  };
}

function manyCards(count: number): CommunityCard[] {
  return Array.from({ length: count }, (_, i) => card(`design${String(i).padStart(3, '0')}`));
}

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

function signIn(): void {
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'u1', provider: 'github', email: 'andy@example.com' },
  });
}

beforeEach(() => {
  indexMock.mockReset();
  mineIndexMock.mockReset();
  localStorage.clear();
  setOnline(true);
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
  useMineStore.setState({ ...INITIAL_MINE_STATE });
  useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
  useGapFitStore.setState({ constraint: null });
  useToastStore.setState({ toasts: [] });
  useSessionStore.setState({ status: 'anonymous', user: null });
});

afterEach(() => {
  useSessionStore.setState({ status: 'unknown', user: null });
  vi.restoreAllMocks();
});

describe('CommunityGalleryTab', () => {
  it('shows skeletons while the index loads, then the card grid', async () => {
    let resolveFetch: () => void = () => {};
    indexMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(ok({ items: [card('a')], capped: false }));
        })
    );
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    expect(screen.getByTestId('community-gallery-skeletons')).toBeInTheDocument();
    resolveFetch();
    await waitFor(() => {
      expect(screen.queryByTestId('community-gallery-skeletons')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Bin a')).toBeInTheDocument();
  });

  it('renders chunks of 24 with a Load more button', async () => {
    indexMock.mockResolvedValue(ok({ items: manyCards(30), capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    // Scoped to the grid list: the shelf landing above renders its own cards.
    await waitFor(() => {
      const grid = screen.getByRole('list', { name: 'community.gallery.gridLabel' });
      expect(within(grid).getAllByTestId('community-card-placeholder')).toHaveLength(
        GALLERY_PAGE_SIZE
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.loadMore' }));
    const grid = screen.getByRole('list', { name: 'community.gallery.gridLabel' });
    expect(within(grid).getAllByTestId('community-card-placeholder')).toHaveLength(30);
    expect(
      screen.queryByRole('button', { name: 'community.gallery.loadMore' })
    ).not.toBeInTheDocument();
  });

  it('shows the cap notice only when the index was capped', async () => {
    indexMock.mockResolvedValue(ok({ items: manyCards(2), capped: true }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('community.gallery.capNotice')).toBeInTheDocument();
    });
  });

  it('opens the detail overlay through the community detail store when a card is selected', async () => {
    const target = card('target123456');
    indexMock.mockResolvedValue(ok({ items: [target], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin target123456')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Bin target123456/ }));
    const request = useCommunityDetailStore.getState().request;
    expect(request?.designId).toBe('target123456');
    expect(request?.card).toEqual(target);
  });

  it('shows the be-first empty state with a design CTA for visitors without local designs', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    const onRequestClose = vi.fn();
    const dispatched = vi.fn();
    window.addEventListener('switch-to-designer', dispatched);
    render(<CommunityGalleryTab onRequestClose={onRequestClose} />);
    await waitFor(() => {
      expect(screen.getByText('community.gallery.empty.title')).toBeInTheDocument();
    });
    const cta = screen.getByRole('button', { name: 'community.gallery.empty.designCta' });
    fireEvent.click(cta);
    expect(dispatched).toHaveBeenCalled();
    expect(onRequestClose).toHaveBeenCalled();
    window.removeEventListener('switch-to-designer', dispatched);
  });

  it('adapts the empty-state CTA when local designs exist and opens the publish flow', async () => {
    localStorage.setItem('gridfinity-designer-active-v1', 'design-id');
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    const onRequestClose = vi.fn();
    const onRequestPublish = vi.fn().mockResolvedValue(true);
    render(
      <CommunityGalleryTab onRequestClose={onRequestClose} onRequestPublish={onRequestPublish} />
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'community.gallery.empty.publishCta' })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.empty.publishCta' }));
    expect(onRequestClose).toHaveBeenCalled();
    expect(onRequestPublish).toHaveBeenCalled();
  });

  it('resets the scroll position when the filters change', async () => {
    indexMock.mockResolvedValue(ok({ items: manyCards(30), capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText('Bin design000').length).toBeGreaterThan(0);
    });
    const scroller = screen.getByTestId('community-gallery-scroll');
    scroller.scrollTop = 400;
    fireEvent.change(screen.getByLabelText('community.gallery.searchLabel'), {
      target: { value: 'design' },
    });
    expect(scroller.scrollTop).toBe(0);
  });

  it('toasts when the publish CTA cannot find the active design', async () => {
    localStorage.setItem('gridfinity-designer-active-v1', 'design-id');
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    const onRequestPublish = vi.fn().mockResolvedValue(false);
    render(<CommunityGalleryTab onRequestClose={vi.fn()} onRequestPublish={onRequestPublish} />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'community.gallery.empty.publishCta' })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.empty.publishCta' }));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'community.toast.publishDesignMissing'
      );
    });
  });

  it('does not open the publish flow from the design CTA when no local design exists', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    const onRequestPublish = vi.fn().mockResolvedValue(true);
    render(<CommunityGalleryTab onRequestClose={vi.fn()} onRequestPublish={onRequestPublish} />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'community.gallery.empty.designCta' })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.empty.designCta' }));
    expect(onRequestPublish).not.toHaveBeenCalled();
  });

  it('shows a no-matches state whose action clears the filters', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin a')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('community.gallery.searchLabel'), {
      target: { value: 'nothing matches this' },
    });
    expect(screen.getByText('community.gallery.noMatches.title')).toBeInTheDocument();
    const clearButtons = screen.getAllByRole('button', {
      name: 'community.gallery.clearFilters',
    });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    expect(screen.getByText('Bin a')).toBeInTheDocument();
  });

  it('shows an error state and retries via the retry button', async () => {
    indexMock.mockResolvedValueOnce(err({ kind: 'server' }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('community.gallery.error.title')).toBeInTheDocument();
    });
    indexMock.mockResolvedValueOnce(ok({ items: [card('a')], capped: false }));
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.error.retry' }));
    await waitFor(() => {
      expect(screen.getByText('Bin a')).toBeInTheDocument();
    });
  });

  it('shows the offline state for a network failure while offline', async () => {
    setOnline(false);
    indexMock.mockResolvedValue(err({ kind: 'network' }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('community.gallery.offline.title')).toBeInTheDocument();
    });
  });

  it('retries automatically when the browser comes back online after a failure', async () => {
    setOnline(false);
    indexMock.mockResolvedValueOnce(err({ kind: 'network' }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('community.gallery.offline.title')).toBeInTheDocument();
    });
    indexMock.mockResolvedValueOnce(ok({ items: [card('a')], capped: false }));
    setOnline(true);
    fireEvent(window, new Event('online'));
    await waitFor(() => {
      expect(screen.getByText('Bin a')).toBeInTheDocument();
    });
  });

  it('keeps stale items visible with an inline refresh error banner', async () => {
    indexMock.mockResolvedValueOnce(ok({ items: [card('a')], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin a')).toBeInTheDocument();
    });
    indexMock.mockResolvedValueOnce(err({ kind: 'server' }));
    await useBrowseStore.getState().refreshIndex();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Bin a')).toBeInTheDocument();
  });

  it('clicking a card author filters the gallery to that author with a clearable chip', async () => {
    const alice = 'f'.repeat(32);
    const bob = 'e'.repeat(32);
    indexMock.mockResolvedValue(
      ok({
        items: [
          card('byalice00001', { authorName: 'Alice', authorPublicId: alice }),
          card('bybob0000001', { authorName: 'Bob', authorPublicId: bob }),
        ],
        capped: false,
      })
    );
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin byalice00001')).toBeInTheDocument();
    });
    const authorButtons = screen.getAllByTestId('community-card-author');
    fireEvent.click(authorButtons[0]);
    expect(useBrowseStore.getState().filters.author).toEqual({ id: alice, name: 'Alice' });
    expect(trackEvent).toHaveBeenCalledWith('community_author_filter_applied', {
      surface: 'card',
    });
    expect(screen.getByText('Bin byalice00001')).toBeInTheDocument();
    expect(screen.queryByText('Bin bybob0000001')).not.toBeInTheDocument();
    expect(useCommunityDetailStore.getState().request).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.clearAuthorFilter' }));
    expect(useBrowseStore.getState().filters.author).toBeNull();
    expect(screen.getByText('Bin bybob0000001')).toBeInTheDocument();
  });

  it('shows the author empty state with a show-all action when the author has nothing', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin a')).toBeInTheDocument();
    });
    useBrowseStore.getState().setAuthor({ id: 'd'.repeat(32), name: 'Ghost' });
    expect(await screen.findByText('community.gallery.authorEmpty.title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.showAllDesigns' }));
    expect(useBrowseStore.getState().filters.author).toBeNull();
    expect(screen.getByText('Bin a')).toBeInTheDocument();
  });

  it('shows the liked empty state with the heart hint when nothing is liked', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('a')], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin a')).toBeInTheDocument();
    });
    useBrowseStore.getState().setLikedOnly(true);
    expect(await screen.findByText('community.gallery.likedEmpty.title')).toBeInTheDocument();
    expect(screen.getByText('community.gallery.likedEmpty.subtitle')).toBeInTheDocument();
    expect(screen.queryByText('community.gallery.noMatches.title')).not.toBeInTheDocument();
  });

  it('filters to liked cards when the liked filter is active', async () => {
    indexMock.mockResolvedValue(
      ok({
        items: [card('liked0000001', { likedByMe: true }), card('other0000001')],
        capped: false,
      })
    );
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin other0000001')).toBeInTheDocument();
    });
    useBrowseStore.getState().setLikedOnly(true);
    await waitFor(() => {
      expect(screen.queryByText('Bin other0000001')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Bin liked0000001')).toBeInTheDocument();
  });

  it('shows recently-viewed designs most-recent-first when the recent filter is active', async () => {
    localStorage.setItem(
      'gridfinity-community-recently-viewed-v1',
      JSON.stringify([
        { id: 'second000001', viewedAt: 2000 },
        { id: 'first0000001', viewedAt: 1000 },
      ])
    );
    indexMock.mockResolvedValue(
      ok({
        items: [
          card('first0000001', { createdAt: 9000 }),
          card('unviewed0001', { createdAt: 8000 }),
          card('second000001', { createdAt: 1000 }),
        ],
        capped: false,
      })
    );
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin unviewed0001')).toBeInTheDocument();
    });
    useBrowseStore.getState().setRecentOnly(true);
    await waitFor(() => {
      expect(screen.queryByText('Bin unviewed0001')).not.toBeInTheDocument();
    });
    const names = screen
      .getAllByTestId('community-card-author')
      .map((el) => el.closest('[data-community-card]'))
      .map((el) => el?.getAttribute('aria-label'));
    expect(names).toEqual(['Bin second000001', 'Bin first0000001']);
  });

  it('tracks the gallery open with the tab surface by default', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    expect(trackEvent).toHaveBeenCalledWith('community_gallery_opened', { surface: 'tab' });
    await waitFor(() => {
      expect(screen.queryByTestId('community-gallery-skeletons')).not.toBeInTheDocument();
    });
  });

  it('tracks the gallery open with the route surface when hosted full-page', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} surface="route" />);
    expect(trackEvent).toHaveBeenCalledWith('community_gallery_opened', { surface: 'route' });
    await waitFor(() => {
      expect(screen.queryByTestId('community-gallery-skeletons')).not.toBeInTheDocument();
    });
  });
});

describe('CommunityGalleryTab Mine view', () => {
  function activateMine(): void {
    signIn();
    useBrowseStore.getState().setMineOnly(true);
  }

  it('sources cards from the mine list, including hidden designs with their badges', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('public000001')], capped: false }));
    mineIndexMock.mockResolvedValue(
      ok({
        items: [
          card('mylive000001'),
          card('myhidden0001', { status: 'hidden', hiddenReason: 'reports' }),
          card('mydenied0001', { status: 'hidden', hiddenReason: 'denylist' }),
        ],
        capped: false,
      })
    );
    activateMine();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
    expect(screen.getByText('Bin myhidden0001')).toBeInTheDocument();
    expect(screen.getByTestId('community-hidden-badge')).toBeInTheDocument();
    expect(screen.getByTestId('community-denylisted-badge')).toBeInTheDocument();
    expect(screen.queryByText('Bin public000001')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('community-mine-card')).toHaveLength(3);
    expect(trackEvent).toHaveBeenCalledWith('community_mine_viewed', { surface: 'tab' });
  });

  it('shows the mine empty state with a publish CTA when nothing is published', async () => {
    localStorage.setItem('gridfinity-designer-active-v1', 'design-id');
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    mineIndexMock.mockResolvedValue(ok({ items: [], capped: false }));
    const onRequestClose = vi.fn();
    const onRequestPublish = vi.fn().mockResolvedValue(true);
    activateMine();
    render(
      <CommunityGalleryTab onRequestClose={onRequestClose} onRequestPublish={onRequestPublish} />
    );
    await waitFor(() => {
      expect(screen.getByText('community.gallery.mineEmpty.title')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('community-mine-empty-cta'));
    expect(onRequestClose).toHaveBeenCalled();
    expect(onRequestPublish).toHaveBeenCalled();
  });

  it('falls back to the public grid when the session signs out mid-visit', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('public000001')], capped: false }));
    mineIndexMock.mockResolvedValue(ok({ items: [card('mylive000001')], capped: false }));
    activateMine();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
    useSessionStore.setState({ status: 'anonymous', user: null });
    await waitFor(() => {
      expect(screen.getByText('Bin public000001')).toBeInTheDocument();
    });
    expect(useBrowseStore.getState().filters.mineOnly).toBe(false);
    expect(screen.queryByText('Bin mylive000001')).not.toBeInTheDocument();
  });

  it('applies the toolbar search within Mine', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    mineIndexMock.mockResolvedValue(
      ok({ items: [card('myscrews0001'), card('mybolts00001')], capped: false })
    );
    activateMine();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin myscrews0001')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('community.gallery.searchLabel'), {
      target: { value: 'myscrews' },
    });
    expect(screen.getByText('Bin myscrews0001')).toBeInTheDocument();
    expect(screen.queryByText('Bin mybolts00001')).not.toBeInTheDocument();
  });

  it('switches to the designer and closes when a mine edit opens', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    mineIndexMock.mockResolvedValue(ok({ items: [card('mylive000001')], capped: false }));
    const onRequestClose = vi.fn();
    const onEditOwnDesign = vi.fn().mockResolvedValue('opened');
    const dispatched = vi.fn();
    window.addEventListener('switch-to-designer', dispatched);
    activateMine();
    render(
      <CommunityGalleryTab onRequestClose={onRequestClose} onEditOwnDesign={onEditOwnDesign} />
    );
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('community-mine-edit'));
    await waitFor(() => {
      expect(onRequestClose).toHaveBeenCalled();
    });
    expect(onEditOwnDesign).toHaveBeenCalledWith({ id: 'mylive000001' });
    expect(dispatched).toHaveBeenCalled();
    window.removeEventListener('switch-to-designer', dispatched);
  });

  it('toasts and opens the detail as the recovery path when no local copy exists', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    mineIndexMock.mockResolvedValue(ok({ items: [card('mylive000001')], capped: false }));
    const onEditOwnDesign = vi.fn().mockResolvedValue('missing');
    activateMine();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} onEditOwnDesign={onEditOwnDesign} />);
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('community-mine-edit'));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'community.mine.editMissing'
      );
    });
    expect(useCommunityDetailStore.getState().request?.designId).toBe('mylive000001');
  });

  it('toasts the failure copy when the mine edit errors', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    mineIndexMock.mockResolvedValue(ok({ items: [card('mylive000001')], capped: false }));
    const onEditOwnDesign = vi.fn().mockResolvedValue('error');
    activateMine();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} onEditOwnDesign={onEditOwnDesign} />);
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('community-mine-edit'));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'community.detail.editOriginalFailed'
      );
    });
    expect(useCommunityDetailStore.getState().request).toBeNull();
  });

  it('shows the mine error state and retries against the mine index', async () => {
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    mineIndexMock.mockResolvedValueOnce(err({ kind: 'server' }));
    activateMine();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('community.gallery.error.title')).toBeInTheDocument();
    });
    mineIndexMock.mockResolvedValueOnce(ok({ items: [card('mylive000001')], capped: false }));
    fireEvent.click(screen.getByRole('button', { name: 'community.gallery.error.retry' }));
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
  });
});

describe('CommunityGalleryTab shelf landing', () => {
  function shelfCards(count: number): CommunityCard[] {
    return Array.from({ length: count }, (_, i) =>
      card(`design${String(i).padStart(3, '0')}`, {
        createdAt: 1000 + i,
        featured: i === 0,
      })
    );
  }

  it('shows the shelves over a ready public index at the landing threshold', async () => {
    indexMock.mockResolvedValue(ok({ items: shelfCards(12), capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('community-shelves')).toBeInTheDocument();
    });
    expect(screen.getByText('community.shelves.staffPicks')).toBeInTheDocument();
  });

  it('keeps the plain grid below the threshold', async () => {
    indexMock.mockResolvedValue(ok({ items: shelfCards(11), capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin design000')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('community-shelves')).not.toBeInTheDocument();
  });

  it('hides the shelves once any filter is active and restores them on clear', async () => {
    indexMock.mockResolvedValue(ok({ items: shelfCards(12), capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('community-shelves')).toBeInTheDocument();
    });
    // Category lives behind the filter disclosure now; set it on the store so
    // the assertion stays about the shelves, not about reaching the control.
    act(() => {
      useBrowseStore.getState().setCategory('kitchen');
    });
    expect(screen.queryByTestId('community-shelves')).not.toBeInTheDocument();
    const clearButtons = screen.getAllByRole('button', { name: 'community.gallery.clearFilters' });
    fireEvent.click(clearButtons[0]);
    expect(screen.getByTestId('community-shelves')).toBeInTheDocument();
  });

  it('never shows shelves in the Mine view', async () => {
    indexMock.mockResolvedValue(ok({ items: shelfCards(12), capped: false }));
    mineIndexMock.mockResolvedValue(ok({ items: [card('mylive000001')], capped: false }));
    signIn();
    useBrowseStore.getState().setMineOnly(true);
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Bin mylive000001')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('community-shelves')).not.toBeInTheDocument();
  });

  it('see all on staff picks filters the grid to featured designs', async () => {
    indexMock.mockResolvedValue(ok({ items: shelfCards(12), capped: false }));
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('community-shelves')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('community-shelf-see-all-staff-picks'));
    expect(useBrowseStore.getState().filters.featuredOnly).toBe(true);
    // The shelves are a landing affordance; an active filter replaces them
    // with the filtered grid.
    expect(screen.queryByTestId('community-shelves')).not.toBeInTheDocument();
    const grid = screen.getByRole('list', { name: 'community.gallery.gridLabel' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(1);
    expect(within(grid).getByText('Bin design000')).toBeInTheDocument();
  });
});

describe('CommunityGalleryTab fits-gap sync', () => {
  const setConstraint = () => {
    useGapFitStore.getState().setConstraint({
      maxWidth: gridUnits(2.5),
      maxDepth: gridUnits(3),
      maxHeight: heightUnits(6),
      gridUnitMm: 42 as Mm,
      gridUnitMmY: 42 as Mm,
      heightUnitMm: 7 as Mm,
      targetPosition: { x: gridUnits(1), y: gridUnits(1), layerId: layerId('layer_1') },
    });
  };

  it('pre-applies the gap bounds and the best-fit sort from the core handoff', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('design001')], capped: false }));
    setConstraint();
    render(<CommunityGalleryTab onRequestClose={vi.fn()} surface="fits_gap" />);

    await waitFor(() => {
      expect(useBrowseStore.getState().fitsGapContext).toEqual({
        widthMax: 2.5,
        depthMax: 3,
        maxHeight: 6,
        gridUnitMm: 42,
        gridUnitMmY: 42,
        heightUnitMm: 7,
      });
    });
    expect(useBrowseStore.getState().filters.sort).toBe('best-fit');
    expect(trackEvent).toHaveBeenCalledWith('community_gallery_opened', { surface: 'fits_gap' });
  });

  it('shows a gap-specific empty state whose action clears the gap context', async () => {
    // Default card is 2x3: nothing fits a 1x1 gap in either orientation.
    indexMock.mockResolvedValue(ok({ items: [card('design001')], capped: false }));
    useGapFitStore.getState().setConstraint({
      maxWidth: gridUnits(1),
      maxDepth: gridUnits(1),
      maxHeight: heightUnits(6),
      gridUnitMm: 42 as Mm,
      gridUnitMmY: 42 as Mm,
      heightUnitMm: 7 as Mm,
      targetPosition: { x: gridUnits(1), y: gridUnits(1), layerId: layerId('layer_1') },
    });
    render(<CommunityGalleryTab onRequestClose={vi.fn()} surface="fits_gap" />);

    await waitFor(() => {
      expect(screen.getByText('community.gallery.fitsGapEmpty.title')).toBeInTheDocument();
    });
    // The generic no-matches state (whose clearFilters preserves the gap)
    // must not render here.
    expect(screen.queryByText('community.gallery.noMatches.title')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('community-fits-gap-empty-clear'));
    expect(useBrowseStore.getState().fitsGapContext).toBeNull();
    expect(useGapFitStore.getState().constraint).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('Bin design001')).toBeInTheDocument();
    });
  });

  it('drops a stale gap context when the handoff has been cleared', async () => {
    indexMock.mockResolvedValue(ok({ items: [card('design001')], capped: false }));
    useBrowseStore.getState().setFitsGapContext({
      widthMax: 2,
      depthMax: 2,
      maxHeight: 6,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      heightUnitMm: 7,
    });
    render(<CommunityGalleryTab onRequestClose={vi.fn()} />);

    await waitFor(() => {
      expect(useBrowseStore.getState().fitsGapContext).toBeNull();
    });
    // Nothing to score against once the context drops.
    expect(useBrowseStore.getState().filters.sort).toBe('newest');
  });
});
