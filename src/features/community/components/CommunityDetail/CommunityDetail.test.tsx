import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityCard, CommunityDesign } from '@/shared/types/community';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import { useToastStore } from '@/core/store/toast';

vi.mock('../../api/client', () => ({
  fetchCommunityDesign: vi.fn(),
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

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

import { fetchCommunityDesign } from '../../api/client';
import { trackEvent } from '@/shared/analytics/posthog';
import { CommunityDetail } from './CommunityDetail';

const fetchMock = vi.mocked(fetchCommunityDesign);

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

interface RenderOptions {
  onRequestCloseGallery?: () => void;
  onRemixDesign?: (
    design: CommunityDesign,
    options?: { ownDuplicate?: boolean }
  ) => Promise<boolean>;
  onEditOriginal?: (design: CommunityDesign) => Promise<'opened' | 'missing' | 'error'>;
  surface?: 'tab' | 'route';
}

function renderDetail(options: RenderOptions = {}) {
  const props = {
    onRequestCloseGallery: options.onRequestCloseGallery ?? vi.fn(),
    onRemixDesign: options.onRemixDesign ?? vi.fn().mockResolvedValue(true),
    onEditOriginal: options.onEditOriginal ?? vi.fn().mockResolvedValue('opened' as const),
    surface: options.surface,
  };
  return { ...render(<CommunityDetail {...props} />), props };
}

function openDetail() {
  useCommunityDetailStore.getState().open(card().id, card());
}

describe('CommunityDetail', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(trackEvent).mockClear();
    useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
    useToastStore.setState({ toasts: [] });
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
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
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
    fetchMock.mockResolvedValueOnce(ok({ design: communityDesign(), isOwner: false }));
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    fireEvent(window, new Event('online'));
    expect(await screen.findByText('by Jo')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error state with a retry that refetches', async () => {
    fetchMock.mockResolvedValueOnce(err({ kind: 'network' }));
    fetchMock.mockResolvedValueOnce(ok({ design: communityDesign(), isOwner: false }));
    openDetail();
    renderDetail();
    expect(await screen.findByText("Couldn't load this design.")).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('by Jo')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders Remix as the primary action for a non-owner', async () => {
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
    openDetail();
    renderDetail();
    expect(await screen.findByText('Remix')).toBeInTheDocument();
    expect(screen.queryByText('Edit original')).not.toBeInTheDocument();
    expect(screen.queryByText('Duplicate as new')).not.toBeInTheDocument();
  });

  it('replaces Remix with owner actions when the server marks ownership', async () => {
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: true }));
    openDetail();
    renderDetail();
    expect(await screen.findByText('Edit original')).toBeInTheDocument();
    expect(screen.getByText('Duplicate as new')).toBeInTheDocument();
    expect(screen.queryByText('Remix')).not.toBeInTheDocument();
  });

  it('remix creates the copy, tracks, switches to the designer, and closes everything', async () => {
    const design = communityDesign();
    fetchMock.mockResolvedValue(ok({ design, isOwner: false }));
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
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
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
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: true }));
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
    fetchMock.mockResolvedValue(ok({ design, isOwner: true }));
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
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
    openDetail();
    renderDetail();
    await screen.findByText('by Jo');
    fireEvent.popState(window);
    await waitFor(() => expect(useCommunityDetailStore.getState().request).toBeNull());
  });

  it('consumes the trapped history entry when closed from the UI', async () => {
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
    openDetail();
    renderDetail();
    await screen.findByText('by Jo');
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(useCommunityDetailStore.getState().request).toBeNull());
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  it('route surface: tracks the view with surface route and skips the history trap', async () => {
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
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
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
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
    fetchMock.mockResolvedValue(ok({ design: communityDesign(), isOwner: false }));
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
      if (id === 'Child1234567') return Promise.resolve(ok({ design: remix, isOwner: false }));
      return Promise.resolve(
        ok({
          design: communityDesign({
            id: 'Parent123456',
            name: 'Renamed Parent',
            authorName: 'Samuel',
          }),
          isOwner: false,
        })
      );
    });
    useCommunityDetailStore.getState().open('Child1234567', card({ id: 'Child1234567' }));
    renderDetail();
    // Both the parent name and the parent author upgrade to the live record.
    expect(await screen.findByText(/Remixed from Renamed Parent by Samuel/)).toBeInTheDocument();
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
      if (id === 'Child1234567') return Promise.resolve(ok({ design: remix, isOwner: false }));
      return Promise.resolve(err({ kind: 'notFound' as const }));
    });
    useCommunityDetailStore.getState().open('Child1234567', card({ id: 'Child1234567' }));
    renderDetail();
    expect(await screen.findByText(/Remixed from Older Bin by Sam/)).toBeInTheDocument();
    expect(await screen.findByText(/no longer published/)).toBeInTheDocument();
  });
});
