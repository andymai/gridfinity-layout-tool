// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ok } from '@/core/result';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityCard, CommunityDesign } from '@/shared/types/community';
import { fetchCommunityIndex } from '../../api/client';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { SIMILAR_DESIGNS_MAX } from '../../utils/similarDesigns';
import { SimilarRail } from './SimilarRail';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, fetchCommunityIndex: vi.fn() };
});

const indexMock = vi.mocked(fetchCommunityIndex);

const params = { width: 2, depth: 3, height: 6 } as unknown as BinParams;

function design(overrides: Partial<CommunityDesign> = {}): CommunityDesign {
  return {
    id: 'target123456',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Jo',
    name: 'Screw Bin',
    description: '',
    category: 'hardware',
    techniques: ['scoop'],
    params,
    metrics: { width: 84, depth: 126, height: 42, gridUnitMm: 42 },
    lineage: null,
    thumbnails: ['https://blob.example/t0.webp'],
    meshUrl: 'https://blob.example/mesh.glb',
    photos: [],
    featured: false,
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

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
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
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

describe('SimilarRail', () => {
  it('renders similar designs from the loaded index, excluding the target itself', () => {
    seedIndex([card('target123456'), card('similar00001'), card('similar00002')]);
    render(<SimilarRail design={design()} />);
    const tiles = screen.getAllByTestId('community-similar-tile');
    expect(tiles).toHaveLength(2);
    expect(screen.getByText('Bin similar00001')).toBeInTheDocument();
    expect(screen.queryByText('Bin target123456')).not.toBeInTheDocument();
  });

  it('caps the rail at six designs', () => {
    seedIndex(Array.from({ length: 10 }, (_, i) => card(`similar0000${i}`)));
    render(<SimilarRail design={design()} />);
    expect(screen.getAllByTestId('community-similar-tile')).toHaveLength(SIMILAR_DESIGNS_MAX);
  });

  it('renders nothing when no design shares a signal', () => {
    seedIndex([
      card('unrelated001', {
        category: 'kitchen',
        techniques: ['slotted'],
        metrics: { width: 420, depth: 420, height: 42, gridUnitMm: 42 },
      }),
    ]);
    render(<SimilarRail design={design()} />);
    expect(screen.queryByTestId('community-similar-rail')).not.toBeInTheDocument();
  });

  it('renders nothing until the index is ready, and loads it on a cold open', async () => {
    let resolveFetch: () => void = () => {};
    indexMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(ok({ items: [card('similar00001')], capped: false }));
        })
    );
    render(<SimilarRail design={design()} />);
    expect(screen.queryByTestId('community-similar-rail')).not.toBeInTheDocument();
    expect(indexMock).toHaveBeenCalledTimes(1);
    resolveFetch();
    expect(await screen.findByTestId('community-similar-rail')).toBeInTheDocument();
  });

  it('does not refetch when the gallery already loaded a fresh index', () => {
    seedIndex([card('similar00001')]);
    render(<SimilarRail design={design()} />);
    expect(indexMock).not.toHaveBeenCalled();
  });

  it('opens the tapped design detail through the community detail store', () => {
    const target = card('similar00001');
    seedIndex([target]);
    render(<SimilarRail design={design()} />);
    fireEvent.click(screen.getByTestId('community-similar-tile'));
    const request = useCommunityDetailStore.getState().request;
    expect(request?.designId).toBe('similar00001');
    expect(request?.card).toEqual(target);
  });
});
