// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ok } from '@/core/result';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import type { CommunityCard } from '@/shared/types/community';
import { fetchCommunityIndex } from '../../api/client';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { DirectRemixList } from './DirectRemixList';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, fetchCommunityIndex: vi.fn() };
});

const indexMock = vi.mocked(fetchCommunityIndex);

const PARENT_ID = 'parent123456';

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'b'.repeat(32),
    category: 'hardware',
    techniques: ['scoop'],
    metrics: { width: 84, depth: 126, height: 42, gridUnitMm: 42 },
    thumbnailUrl: `https://blob/${id}.webp`,
    isRemix: false,
    parentId: '',
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

function remixCard(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return card(id, { isRemix: true, parentId: PARENT_ID, ...overrides });
}

function seedIndex(items: CommunityCard[]): void {
  useBrowseStore.setState({ status: 'ready', items, fetchedAt: Date.now() });
}

beforeEach(() => {
  indexMock.mockReset();
  indexMock.mockResolvedValue(ok({ items: [], capped: false }));
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
  useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DirectRemixList', () => {
  it('lists only the direct remixes of the design, newest first', () => {
    seedIndex([
      card(PARENT_ID),
      remixCard('remix0000001', { createdAt: 1000 }),
      remixCard('remix0000002', { createdAt: 3000 }),
      remixCard('otherchild01', { parentId: 'someoneelse1' }),
      card('unrelated001'),
    ]);
    render(<DirectRemixList designId={PARENT_ID} remixCount={2} />);
    const tiles = screen.getAllByTestId('community-remix-tile');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveAccessibleName('community.detail.similarItemAria');
    expect(screen.getByText('Bin remix0000002')).toBeInTheDocument();
    expect(screen.queryByText('Bin otherchild01')).not.toBeInTheDocument();
    expect(
      screen
        .getAllByText('Bin remix0000002')[0]
        .compareDocumentPosition(screen.getAllByText('Bin remix0000001')[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('falls back to an explanation when the counted remixes are not in the index', () => {
    // Children beyond the capped index (or hidden since) have no card.
    seedIndex([card(PARENT_ID)]);
    render(<DirectRemixList designId={PARENT_ID} remixCount={3} />);
    expect(screen.getByText('community.detail.buildsOnEmpty')).toBeInTheDocument();
    expect(screen.queryByTestId('community-remix-tile')).not.toBeInTheDocument();
  });

  it('renders nothing until the index is ready, and loads it on a cold open', async () => {
    let resolveFetch: () => void = () => {};
    indexMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(ok({ items: [remixCard('remix0000001')], capped: false }));
        })
    );
    render(<DirectRemixList designId={PARENT_ID} remixCount={1} />);
    expect(screen.queryByTestId('community-remix-list')).not.toBeInTheDocument();
    expect(indexMock).toHaveBeenCalledTimes(1);
    resolveFetch();
    expect(await screen.findByTestId('community-remix-list')).toBeInTheDocument();
  });

  it('opens the tapped remix detail through the community detail store', () => {
    const target = remixCard('remix0000001');
    seedIndex([target]);
    render(<DirectRemixList designId={PARENT_ID} remixCount={1} />);
    fireEvent.click(screen.getByTestId('community-remix-tile'));
    const request = useCommunityDetailStore.getState().request;
    expect(request?.designId).toBe('remix0000001');
    expect(request?.card).toEqual(target);
  });
});
