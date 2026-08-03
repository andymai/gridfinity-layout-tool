import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ok, err } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityCard, CommunityDesign } from '@/shared/types/community';
import type { CommunityPlaceOutcome } from '@/shared/types/communityDetail';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import { useToastStore } from '@/core/store/toast';

vi.mock('../../api/client', () => ({
  fetchCommunityDesign: vi.fn(),
  fetchCommunityIndex: vi.fn(),
  setDesignLiked: vi.fn(),
  reportDesign: vi.fn(),
}));

// The overlay fetches prints for its CTA and cost panel. Left unmocked these
// are real network calls in a component test: nondeterministic, and slow
// enough under CI load to push the reconnect assertion past its timeout.
vi.mock('../../api/printsClient', () => ({
  fetchPrints: vi.fn(async () => ok({ items: [], nextCursor: null, summary: null, mine: null })),
  setCoverPhoto: vi.fn(),
  reportPrint: vi.fn(),
  savePrint: vi.fn(),
  deletePrint: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/shared/components/GlbViewer', () => ({
  GlbViewer: ({ loadBehavior }: { loadBehavior?: string }) => (
    <div data-testid="glb-viewer" data-load={loadBehavior ?? 'auto'} />
  ),
}));

vi.mock('@/shared/components/preview/GradientBackground', () => ({
  GradientBackground: () => null,
}));

const responsiveMock = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: responsiveMock.isMobile }),
}));

import {
  fetchCommunityDesign,
  fetchCommunityIndex,
  reportDesign,
  setDesignLiked,
} from '../../api/client';
import type { CommunityDesignDetail } from '../../api/client';
import { trackEvent } from '@/shared/analytics/posthog';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useGapFitStore } from '@/core/store/gapFit';
import { gridUnits, heightUnits, layerId } from '@/core/types';
import type { Mm } from '@/core/types';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { loadRecentlyViewedIds } from '../../utils/recentlyViewed';
import { CommunityDetail } from './CommunityDetail';

const fetchMock = vi.mocked(fetchCommunityDesign);
const indexMock = vi.mocked(fetchCommunityIndex);
const likeMock = vi.mocked(setDesignLiked);
const reportMock = vi.mocked(reportDesign);

const params = { width: 2, depth: 3, height: 6 } as unknown as BinParams;

function communityDesign(overrides: Partial<CommunityDesign> = {}): CommunityDesign {
  return {
    id: 'Abc123456789',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Jo',
    name: 'Screw Bin',
    description: 'A bin for screws',
    category: 'hardware',
    techniques: ['scoop'],
    params,
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    lineage: null,
    thumbnails: ['https://blob.example/t0.webp'],
    meshUrl: 'https://blob.example/mesh.glb',
    photos: [],
    featured: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    status: 'live',
    ...overrides,
  };
}

function card(overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id: 'Abc123456789',
    name: 'Screw Bin',
    authorName: 'Jo',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['scoop'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: 'https://blob.example/t0.webp',
    isRemix: false,
    featured: false,
    counts: { likes: 12, remixes: 4, exports: 9 },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    status: 'live',
    ...overrides,
  };
}

function detail(overrides: Partial<CommunityDesignDetail> = {}): CommunityDesignDetail {
  return {
    design: communityDesign(),
    isOwner: false,
    counts: null,
    likedByMe: false,
    hiddenReason: null,
    hiddenReasonCategory: null,
    ...overrides,
  };
}

interface RenderOptions {
  onRequestCloseGallery?: () => void;
  onRemixDesign?: (
    design: CommunityDesign,
    options?: { ownDuplicate?: boolean }
  ) => Promise<boolean>;
  onEditOriginal?: (design: CommunityDesign) => Promise<'opened' | 'missing' | 'error'>;
  onPlaceInLayout?: (design: CommunityDesign) => Promise<CommunityPlaceOutcome>;
  surface?: 'tab' | 'route' | 'fits_gap';
}

function renderDetail(options: RenderOptions = {}) {
  const props = {
    onRequestCloseGallery: options.onRequestCloseGallery ?? vi.fn(),
    onRemixDesign: options.onRemixDesign ?? vi.fn().mockResolvedValue(true),
    onEditOriginal: options.onEditOriginal ?? vi.fn().mockResolvedValue('opened' as const),
    onPlaceInLayout: options.onPlaceInLayout,
    surface: options.surface,
  };
  return { ...render(<CommunityDetail {...props} />), props };
}

function openDetail() {
  useCommunityDetailStore.getState().open(card().id, card());
}

describe('CommunityDetail', () => {
  beforeEach(() => {
    responsiveMock.isMobile = false;
    fetchMock.mockReset();
    indexMock.mockReset();
    indexMock.mockResolvedValue(ok({ items: [], capped: false }));
    likeMock.mockReset();
    reportMock.mockReset();
    localStorage.clear();
    vi.mocked(trackEvent).mockClear();
    useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
    useToastStore.setState({ toasts: [] });
    useGapFitStore.setState({ constraint: null });
    // status ready + fresh fetchedAt: the similar rail's ensureIndex must not
    // start a load over the seeded items.
    useBrowseStore.setState({
      ...INITIAL_BROWSE_STATE,
      items: [card()],
      status: 'ready',
      fetchedAt: Date.now(),
    });
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    // Simulates the browser: back() traverses and fires a real popstate, which
    // the history trap relies on to consume its entry before navigating.
    vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when no detail request is open', () => {
    renderDetail();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a loading state, then the record, and tracks the view', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    expect(screen.getByText('Loading design…')).toBeInTheDocument();
    expect(await screen.findByText('by Jo')).toBeInTheDocument();
    expect(screen.getByText('A bin for screws')).toBeInTheDocument();
    expect(screen.getByText('Published under the CC BY 4.0 license.')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('community_detail_viewed', { surface: 'tab' });
  });

  it('shows the no-longer-available state for a hidden or removed id', async () => {
    fetchMock.mockResolvedValue(err({ kind: 'notFound' }));
    openDetail();
    renderDetail();
    expect(await screen.findByText('This design is no longer available.')).toBeInTheDocument();
    expect(screen.queryByText('Remix')).not.toBeInTheDocument();
  });

  it('shows offline copy for a network failure while offline and auto-retries on reconnect', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    fetchMock.mockResolvedValueOnce(err({ kind: 'network' }));
    openDetail();
    renderDetail();
    expect(await screen.findByText('You appear to be offline')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(ok(detail()));
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    fireEvent(window, new Event('online'));
    // Two full fetch-and-render cycles of the whole detail tree (viewer,
    // prints, cost panel, lineage), so the wait is sized to that rather than
    // to a single request. It has twice tripped the old 5s cap on loaded CI
    // runners while passing consistently in isolation.
    expect(await screen.findByText('by Jo', undefined, { timeout: 15000 })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error state with a retry that refetches', async () => {
    fetchMock.mockResolvedValueOnce(err({ kind: 'network' }));
    fetchMock.mockResolvedValueOnce(ok(detail()));
    openDetail();
    renderDetail();
    expect(await screen.findByText("Couldn't load this design.")).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('by Jo')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders Remix as the primary action for a non-owner', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    expect(await screen.findByText('Remix')).toBeInTheDocument();
    expect(screen.queryByText('Edit original')).not.toBeInTheDocument();
    expect(screen.queryByText('Duplicate as new')).not.toBeInTheDocument();
  });

  it('replaces Remix with owner actions when the server marks ownership', async () => {
    fetchMock.mockResolvedValue(ok(detail({ isOwner: true })));
    openDetail();
    renderDetail();
    expect(await screen.findByText('Edit original')).toBeInTheDocument();
    expect(screen.getByText('Duplicate as new')).toBeInTheDocument();
    expect(screen.queryByText('Remix')).not.toBeInTheDocument();
  });

  it('remix creates the copy, tracks, switches to the designer, and closes everything', async () => {
    const design = communityDesign();
    fetchMock.mockResolvedValue(ok(detail({ design })));
    const onRemixDesign = vi.fn().mockResolvedValue(true);
    const onRequestCloseGallery = vi.fn();
    const switched = vi.fn();
    window.addEventListener('switch-to-designer', switched);
    openDetail();
    renderDetail({ onRemixDesign, onRequestCloseGallery });
    fireEvent.click(await screen.findByText('Remix'));
    await waitFor(() =>
      expect(onRemixDesign).toHaveBeenCalledWith(design, { ownDuplicate: false })
    );
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('community_remix_opened'));
    expect(switched).toHaveBeenCalled();
    expect(onRequestCloseGallery).toHaveBeenCalled();
    expect(useCommunityDetailStore.getState().request).toBeNull();
    // The trapped history entry is consumed before the designer navigation,
    // exactly once: no stranded entry, no double pop from the cleanup.
    expect(window.history.back).toHaveBeenCalledTimes(1);
    window.removeEventListener('switch-to-designer', switched);
  });

  it('keeps the detail open and toasts when remix fails', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    const onRemixDesign = vi.fn().mockResolvedValue(false);
    openDetail();
    renderDetail({ onRemixDesign });
    fireEvent.click(await screen.findByText('Remix'));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        "Couldn't create an editable copy."
      )
    );
    expect(useCommunityDetailStore.getState().request).not.toBeNull();
  });

  it('edit original switches to the designer when a local copy opens', async () => {
    fetchMock.mockResolvedValue(ok(detail({ isOwner: true })));
    const onEditOriginal = vi.fn().mockResolvedValue('opened' as const);
    const onRequestCloseGallery = vi.fn();
    openDetail();
    renderDetail({ onEditOriginal, onRequestCloseGallery });
    fireEvent.click(await screen.findByText('Edit original'));
    await waitFor(() => expect(onEditOriginal).toHaveBeenCalled());
    await waitFor(() => expect(onRequestCloseGallery).toHaveBeenCalled());
    expect(useCommunityDetailStore.getState().request).toBeNull();
  });

  it('edit original falls back to duplicate-as-new when no local copy exists', async () => {
    const design = communityDesign();
    fetchMock.mockResolvedValue(ok(detail({ design, isOwner: true })));
    const onEditOriginal = vi.fn().mockResolvedValue('missing' as const);
    const onRemixDesign = vi.fn().mockResolvedValue(true);
    openDetail();
    renderDetail({ onEditOriginal, onRemixDesign });
    fireEvent.click(await screen.findByText('Edit original'));
    await waitFor(() => expect(onRemixDesign).toHaveBeenCalledWith(design, { ownDuplicate: true }));
    expect(
      useToastStore
        .getState()
        .toasts.some((toast) => toast.message.includes('No local copy of this design'))
    ).toBe(true);
  });

  it('closes on browser back via the trapped history entry', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    await screen.findByText('by Jo');
    fireEvent.popState(window);
    await waitFor(() => expect(useCommunityDetailStore.getState().request).toBeNull());
  });

  it('consumes the trapped history entry when closed from the UI', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    await screen.findByText('by Jo');
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(useCommunityDetailStore.getState().request).toBeNull());
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  it('route surface: tracks the view with surface route and skips the history trap', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    const pushSpy = vi.spyOn(window.history, 'pushState');
    openDetail();
    renderDetail({ surface: 'route' });
    await screen.findByText('by Jo');
    expect(trackEvent).toHaveBeenCalledWith('community_detail_viewed', { surface: 'route' });
    // The /community/d/<id> entry is pushed by the route host; the overlay
    // must not stack its URL-less trap entry on top of it.
    expect(pushSpy).not.toHaveBeenCalledWith({ communityDetail: true }, '');
  });

  it('route surface: remix switches to the designer without popping history', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    const switched = vi.fn();
    window.addEventListener('switch-to-designer', switched);
    openDetail();
    renderDetail({ surface: 'route' });
    fireEvent.click(await screen.findByText('Remix'));
    await waitFor(() => expect(switched).toHaveBeenCalled());
    expect(useCommunityDetailStore.getState().request).toBeNull();
    expect(window.history.back).not.toHaveBeenCalled();
    window.removeEventListener('switch-to-designer', switched);
  });

  it('share copies the canonical public URL and toasts', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    openDetail();
    renderDetail();
    fireEvent.click(await screen.findByText('Link to this design'));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/community/d/Abc123456789`)
    );
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain('Link copied')
    );
  });

  it('resolves the lineage line against the live parent record', async () => {
    const remix = communityDesign({
      id: 'Child1234567',
      lineage: {
        parentId: 'Parent123456',
        rootId: 'Parent123456',
        parentName: 'Old Snapshot Name',
        parentAuthorName: 'Sam',
        rootAuthorName: 'Sam',
      },
    });
    fetchMock.mockImplementation((id: string) => {
      if (id === 'Child1234567') return Promise.resolve(ok(detail({ design: remix })));
      return Promise.resolve(
        ok(
          detail({
            design: communityDesign({
              id: 'Parent123456',
              name: 'Renamed Parent',
              authorName: 'Samuel',
            }),
          })
        )
      );
    });
    useCommunityDetailStore.getState().open('Child1234567', card({ id: 'Child1234567' }));
    renderDetail();
    // Both the parent name and the parent author upgrade to the live record.
    // Wait on the resolved content, not just the element: the strip renders
    // with the publish-time snapshot first and upgrades once the live parent
    // record arrives, so findByTestId alone would race that upgrade.
    expect(await screen.findByText(/Renamed Parent/)).toBeInTheDocument();
    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('Samuel');
  });

  it('marks the lineage parent as no longer published when it 404s', async () => {
    const remix = communityDesign({
      id: 'Child1234567',
      lineage: {
        parentId: 'Parent123456',
        rootId: 'Parent123456',
        parentName: 'Older Bin',
        parentAuthorName: 'Sam',
        rootAuthorName: 'Sam',
      },
    });
    fetchMock.mockImplementation((id: string) => {
      if (id === 'Child1234567') return Promise.resolve(ok(detail({ design: remix })));
      return Promise.resolve(err({ kind: 'notFound' as const }));
    });
    useCommunityDetailStore.getState().open('Child1234567', card({ id: 'Child1234567' }));
    renderDetail();
    // Same race: the gone verdict only lands after the parent fetch 404s.
    expect(await screen.findByText(/No longer available/)).toBeInTheDocument();
    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('Older Bin');
  });

  it('renders the stats-row heart with aria-pressed and toggles the like optimistically', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    likeMock.mockResolvedValue(ok({ likes: 13, likedByMe: true }));
    openDetail();
    renderDetail();
    const heart = await screen.findByTestId('community-detail-like');
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('12')).toBeInTheDocument();

    fireEvent.click(heart);

    // Optimistic count from the browse-store patch, then aria-pressed follows.
    expect(await screen.findByText('13')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('community-detail-like')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(likeMock).toHaveBeenCalledWith('Abc123456789', true);
  });

  it('hides the heart only when neither a browse card nor detail stats exist (degraded server)', async () => {
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [] });
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    await screen.findByText('by Jo');
    expect(screen.queryByTestId('community-detail-like')).not.toBeInTheDocument();
  });

  it('falls back to detail-payload stats for a design beyond the browse index', async () => {
    // The 2,000-card index cap (or an index fetch failure) must not strip the
    // stats row and like affordance from the detail view.
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [] });
    fetchMock.mockResolvedValue(
      ok(detail({ counts: { likes: 7, remixes: 3, exports: 5 }, likedByMe: false }))
    );
    likeMock.mockResolvedValue(ok({ likes: 8, likedByMe: true }));
    openDetail();
    renderDetail();
    const heart = await screen.findByTestId('community-detail-like');
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('7')).toBeInTheDocument();

    fireEvent.click(heart);

    // Optimistic patch lands on the detail-local stats (no store card to patch).
    expect(await screen.findByText('8')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('community-detail-like')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(likeMock).toHaveBeenCalledWith('Abc123456789', true);
  });

  it('adopts a resumed post-OAuth like pushed through the store sync', async () => {
    // The detail fetch can race the resumed like write server-side and
    // snapshot likedByMe=false; the sync record must win once ready.
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [] });
    fetchMock.mockResolvedValue(
      ok(detail({ counts: { likes: 7, remixes: 3, exports: 5 }, likedByMe: false }))
    );
    openDetail();
    renderDetail();
    const heart = await screen.findByTestId('community-detail-like');
    expect(heart).toHaveAttribute('aria-pressed', 'false');

    act(() => {
      useCommunityDetailStore
        .getState()
        .syncLike({ designId: 'Abc123456789', likes: 8, likedByMe: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId('community-detail-like')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByText('8')).toBeInTheDocument();

    // A manual toggle starts from the synced state and consumes the record,
    // so the sync cannot replay over the user's later choice.
    likeMock.mockResolvedValue(ok({ likes: 7, likedByMe: false }));
    fireEvent.click(screen.getByTestId('community-detail-like'));
    expect(useCommunityDetailStore.getState().likeSync).toBeNull();
    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith('Abc123456789', false);
    });
    await waitFor(() => {
      expect(screen.getByTestId('community-detail-like')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('keeps unlike enabled on a design that is no longer live (server permits unlike, only new likes)', async () => {
    // The owner viewing their own hidden design with a pre-existing like:
    // the heart must stay enabled to withdraw it even though the design
    // is not 'live'. No browse-store card, so the fetched detail stats
    // (not the stale card snapshot) drive likedByMe.
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [] });
    fetchMock.mockResolvedValue(
      ok(
        detail({
          design: communityDesign({ status: 'hidden' }),
          isOwner: true,
          counts: { likes: 12, remixes: 4, exports: 9 },
          likedByMe: true,
        })
      )
    );
    likeMock.mockResolvedValue(ok({ likes: 11, likedByMe: false }));
    openDetail();
    renderDetail();
    const heart = await screen.findByTestId('community-detail-like');
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    expect(heart).not.toBeDisabled();

    fireEvent.click(heart);

    expect(likeMock).toHaveBeenCalledWith('Abc123456789', false);
    await waitFor(() => {
      expect(screen.getByTestId('community-detail-like')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('opens the sign-in prompt for a signed-out heart tap', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    fireEvent.click(await screen.findByTestId('community-detail-like'));
    expect(
      await screen.findByText(
        'Sign in to like designs. Your like will be applied after you sign in.'
      )
    ).toBeInTheDocument();
    expect(likeMock).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('community_signin_prompt_shown', { intent: 'like' });
  });

  it('offers Report to non-owners and opens the report dialog when signed in', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    fireEvent.click(await screen.findByText('Report'));
    expect(await screen.findByText('Report this design')).toBeInTheDocument();
  });

  it('does not offer Report on an owned design', async () => {
    fetchMock.mockResolvedValue(ok(detail({ isOwner: true })));
    openDetail();
    renderDetail();
    await screen.findByText('Edit original');
    expect(screen.queryByText('Report')).not.toBeInTheDocument();
  });

  it('moves Report into the overflow menu on mobile', async () => {
    responsiveMock.isMobile = true;
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    const overflow = await screen.findByTestId('community-detail-overflow');
    expect(screen.queryByText('Report')).not.toBeInTheDocument();
    fireEvent.click(overflow);
    fireEvent.click(await screen.findByText('Report'));
    expect(await screen.findByText('Report this design')).toBeInTheDocument();
  });

  it('moves the owner secondary action (Duplicate as new) into the overflow on mobile', async () => {
    responsiveMock.isMobile = true;
    fetchMock.mockResolvedValue(ok(detail({ isOwner: true })));
    const onRemixDesign = vi.fn().mockResolvedValue(true);
    openDetail();
    renderDetail({ onRemixDesign });
    await screen.findByText('Edit original');
    // Plan 2.8: owner actions live in the overflow on mobile; the footer
    // keeps only the primary Edit original.
    expect(screen.queryByText('Duplicate as new')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('community-detail-overflow'));
    fireEvent.click(await screen.findByText('Duplicate as new'));
    await waitFor(() => {
      expect(onRemixDesign).toHaveBeenCalledWith(expect.anything(), { ownDuplicate: true });
    });
  });

  it('prompts sign-in instead of the report dialog for anonymous users', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    fireEvent.click(await screen.findByText('Report'));
    expect(
      await screen.findByText('Sign in to report a design to the moderators.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Report this design')).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('community_signin_prompt_shown', { intent: 'report' });
  });

  it('records the design as recently viewed once per dialog instance', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    await screen.findByText('by Jo');
    expect(loadRecentlyViewedIds()).toEqual(['Abc123456789']);
    const firstStored = localStorage.getItem('gridfinity-community-recently-viewed-v1');
    // A reconnect-triggered reload of the same instance must not re-record.
    fireEvent(window, new Event('online'));
    await screen.findByText('by Jo');
    expect(localStorage.getItem('gridfinity-community-recently-viewed-v1')).toBe(firstStored);
  });

  it('author line is a real button that filters the gallery to the author and closes the detail', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    openDetail();
    renderDetail();
    const author = await screen.findByTestId('community-detail-author');
    expect(author.tagName).toBe('BUTTON');
    expect(author).toHaveAccessibleName('See all designs by Jo');

    fireEvent.click(author);

    expect(useBrowseStore.getState().filters.author).toEqual({
      id: 'a'.repeat(32),
      name: 'Jo',
    });
    expect(trackEvent).toHaveBeenCalledWith('community_author_filter_applied', {
      surface: 'detail',
    });
    await waitFor(() => expect(useCommunityDetailStore.getState().request).toBeNull());
  });

  it('shows the similar rail and swaps the detail in place when a tile is tapped', async () => {
    const similar = card({
      id: 'Similar12345',
      name: 'Similar Bin',
      authorPublicId: 'b'.repeat(32),
    });
    useBrowseStore.setState({
      ...INITIAL_BROWSE_STATE,
      items: [card(), similar],
      status: 'ready',
      fetchedAt: Date.now(),
    });
    fetchMock.mockImplementation((id: string) => {
      if (id === 'Similar12345') {
        return Promise.resolve(
          ok(detail({ design: communityDesign({ id: 'Similar12345', name: 'Similar Bin' }) }))
        );
      }
      return Promise.resolve(ok(detail()));
    });
    openDetail();
    renderDetail();
    const rail = await screen.findByTestId('community-similar-rail');
    expect(rail).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('community-similar-tile'));

    expect(useCommunityDetailStore.getState().request?.designId).toBe('Similar12345');
    await waitFor(() => {
      expect(screen.getAllByText('Similar Bin').length).toBeGreaterThan(0);
    });
    // Both openings recorded, most recent first.
    expect(loadRecentlyViewedIds()).toEqual(['Similar12345', 'Abc123456789']);
  });

  describe('fits-gap placement', () => {
    function setGapConstraint(): void {
      useGapFitStore.getState().setConstraint({
        maxWidth: gridUnits(3),
        maxDepth: gridUnits(3),
        maxHeight: heightUnits(6),
        gridUnitMm: 42 as Mm,
        gridUnitMmY: 42 as Mm,
        heightUnitMm: 7 as Mm,
        targetPosition: { x: gridUnits(0), y: gridUnits(0), layerId: layerId('layer_1') },
      });
    }

    it('swaps the primary action to Place in layout while the gap context is active', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      setGapConstraint();
      openDetail();
      renderDetail({ onPlaceInLayout: vi.fn() });
      await screen.findByText('by Jo');

      expect(screen.getByTestId('community-place-in-layout')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open in designer' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remix' })).not.toBeInTheDocument();
    });

    it('keeps Remix primary when the place bridge is wired but no gap is active', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      openDetail();
      renderDetail({ onPlaceInLayout: vi.fn() });
      await screen.findByText('by Jo');

      expect(screen.queryByTestId('community-place-in-layout')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remix' })).toBeInTheDocument();
    });

    it('placed: tracks the event, closes the detail and the whole gallery', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      setGapConstraint();
      openDetail();
      const onPlaceInLayout = vi.fn().mockResolvedValue('placed' as const);
      const onRequestCloseGallery = vi.fn();
      renderDetail({ onPlaceInLayout, onRequestCloseGallery });
      await screen.findByText('by Jo');

      fireEvent.click(screen.getByTestId('community-place-in-layout'));

      await waitFor(() => {
        expect(onRequestCloseGallery).toHaveBeenCalledTimes(1);
      });
      expect(onPlaceInLayout).toHaveBeenCalledTimes(1);
      expect(trackEvent).toHaveBeenCalledWith('community_place_in_layout');
      expect(useCommunityDetailStore.getState().request).toBeNull();
      expect(
        useToastStore.getState().toasts.some((t) => t.message === 'Placed in your layout.')
      ).toBe(true);
    });

    it('no-fit: toasts and keeps the detail and gallery open', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      setGapConstraint();
      openDetail();
      const onPlaceInLayout = vi.fn().mockResolvedValue('no-fit' as const);
      const onRequestCloseGallery = vi.fn();
      renderDetail({ onPlaceInLayout, onRequestCloseGallery });
      await screen.findByText('by Jo');

      fireEvent.click(screen.getByTestId('community-place-in-layout'));

      await waitFor(() => {
        expect(
          useToastStore
            .getState()
            .toasts.some((t) => t.message === "This design doesn't fit the selected gap.")
        ).toBe(true);
      });
      expect(onRequestCloseGallery).not.toHaveBeenCalled();
      expect(useCommunityDetailStore.getState().request).not.toBeNull();
      expect(trackEvent).not.toHaveBeenCalledWith('community_place_in_layout');
    });

    it('error: toasts the failure and stays open', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      setGapConstraint();
      openDetail();
      const onPlaceInLayout = vi.fn().mockResolvedValue('error' as const);
      const onRequestCloseGallery = vi.fn();
      renderDetail({ onPlaceInLayout, onRequestCloseGallery });
      await screen.findByText('by Jo');

      fireEvent.click(screen.getByTestId('community-place-in-layout'));

      await waitFor(() => {
        expect(
          useToastStore
            .getState()
            .toasts.some((t) => t.message === "Couldn't place this design in the layout.")
        ).toBe(true);
      });
      expect(onRequestCloseGallery).not.toHaveBeenCalled();
      expect(useCommunityDetailStore.getState().request).not.toBeNull();
    });

    it('error-copy-saved: the failure toast owns the saved library copy', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      setGapConstraint();
      openDetail();
      const onPlaceInLayout = vi.fn().mockResolvedValue('error-copy-saved' as const);
      const onRequestCloseGallery = vi.fn();
      renderDetail({ onPlaceInLayout, onRequestCloseGallery });
      await screen.findByText('by Jo');

      fireEvent.click(screen.getByTestId('community-place-in-layout'));

      await waitFor(() => {
        expect(
          useToastStore
            .getState()
            .toasts.some(
              (t) =>
                t.message === "Couldn't place this design, but a copy was saved to your library."
            )
        ).toBe(true);
      });
      expect(onRequestCloseGallery).not.toHaveBeenCalled();
      expect(useCommunityDetailStore.getState().request).not.toBeNull();
    });

    it('owners in the gap flow still get Place in layout as the primary action', async () => {
      fetchMock.mockResolvedValue(ok(detail({ isOwner: true })));
      setGapConstraint();
      openDetail();
      const onPlaceInLayout = vi.fn().mockResolvedValue('placed' as const);
      renderDetail({ onPlaceInLayout });
      await screen.findByText('by Jo');

      expect(screen.getByTestId('community-place-in-layout')).toBeInTheDocument();
      // Owner actions stay available in secondary slots.
      expect(screen.getByRole('button', { name: 'Edit original' })).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('community-place-in-layout'));
      await waitFor(() => {
        expect(onPlaceInLayout).toHaveBeenCalledTimes(1);
      });
    });

    it('owners without a gap context keep the plain owner footer', async () => {
      fetchMock.mockResolvedValue(ok(detail({ isOwner: true })));
      openDetail();
      renderDetail({ onPlaceInLayout: vi.fn() });
      await screen.findByText('by Jo');

      expect(screen.queryByTestId('community-place-in-layout')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit original' })).toBeInTheDocument();
    });
  });
});
