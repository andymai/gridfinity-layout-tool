import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import {
  INITIAL_COMMUNITY_PUBLISH_STATE,
  useCommunityPublishStore,
} from '@/core/store/communityPublish';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesign } from '@/shared/types/community';
import { INITIAL_PUBLISH_DIALOG_STATE, usePublishDialogStore } from '../../store/publishStore';
import { fetchOwnDesign } from '../../api/client';
import { useOwnDesignPrefill } from './useOwnDesignPrefill';

vi.mock('../../api/client', () => ({
  fetchOwnDesign: vi.fn(),
}));

vi.mock('@/core/sync/session/sessionApi', () => ({
  getMe: vi.fn(),
}));

import { getMe } from '@/core/sync/session/sessionApi';
import type { SessionUser } from '@/core/sync/session/sessionApi';

const LIVE_USER: SessionUser = { userId: 'u1', provider: 'google', email: 'a@b.c' };

const params = { compartments: { cells: [0] } } as unknown as BinParams;

function record(overrides: Partial<CommunityDesign> = {}): CommunityDesign {
  return {
    id: 'Pub123456789',
    authorPublicId: 'author-public',
    authorName: 'Andy',
    name: 'Published Name',
    description: 'Published description',
    category: 'hardware',
    techniques: [],
    params,
    metrics: { width: 2, depth: 2, height: 6, gridUnitMm: 42 },
    lineage: null,
    thumbnails: [],
    meshUrl: '',
    photos: [],
    featured: false,
    createdAt: 1,
    updatedAt: 1,
    status: 'live',
    ...overrides,
  };
}

describe('useOwnDesignPrefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommunityPublishStore.setState(INITIAL_COMMUNITY_PUBLISH_STATE);
    usePublishDialogStore.setState(INITIAL_PUBLISH_DIALOG_STATE);
    vi.mocked(getMe).mockResolvedValue(LIVE_USER);
  });

  it('does nothing for an unpublished design', () => {
    const { result } = renderHook(() => useOwnDesignPrefill(null, 'authenticated'));
    expect(result.current.pending).toBe(false);
    expect(fetchOwnDesign).not.toHaveBeenCalled();
  });

  it('does not fetch while signed out, where a 404 would be meaningless', () => {
    renderHook(() => useOwnDesignPrefill('Pub123456789', 'anonymous'));
    expect(fetchOwnDesign).not.toHaveBeenCalled();
  });

  it('does not hang a signed-out caller behind a spinner it will never clear', () => {
    // The fetch is skipped entirely while anonymous, so a latched `pending`
    // would leave update mode stuck on "loading published details" forever.
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'anonymous'));
    expect(result.current.pending).toBe(false);
  });

  it('keeps waiting while the session is still resolving', () => {
    // `unknown` may yet become authenticated, so the fetch is still coming.
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'unknown'));
    expect(result.current.pending).toBe(true);
  });

  it('returns the live record so the form edits what is actually public', async () => {
    vi.mocked(fetchOwnDesign).mockResolvedValue(
      ok(record({ coverPhotoUrl: 'https://blob/a.webp' }))
    );
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.prefill).toEqual({
      name: 'Published Name',
      description: 'Published description',
      category: 'hardware',
    });
    expect(result.current.coverUrl).toBe('https://blob/a.webp');
    expect(result.current.failed).toBe(false);
  });

  it('reads a missing cover as the render', async () => {
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(record()));
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.coverUrl).toBe('');
  });

  it('severs the published link on a 404 confirmed by a live session', async () => {
    const onUnpublished = vi.fn();
    useCommunityPublishStore.getState().open(
      {
        designId: 'design-1',
        designName: 'Screw Bin',
        params,
        paramsHash: 'hash',
        publishedId: 'Pub123456789',
        lineage: null,
        draft: null,
      },
      undefined,
      { onPublished: vi.fn().mockResolvedValue(true), onUnpublished, requestRecapture: vi.fn() }
    );
    usePublishDialogStore.getState().open({ mode: 'update' });
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(onUnpublished).toHaveBeenCalledTimes(1);
    expect(useCommunityPublishStore.getState().context?.publishedId).toBeNull();
    expect(usePublishDialogStore.getState().mode).toBe('create');
    expect(result.current.failed).toBe(false);
  });

  it('keeps the link on a 404 the session cannot confirm', async () => {
    // The API also 404s a hidden-but-recoverable design to an expired cookie,
    // so an unconfirmed session must not mint a duplicate.
    const onUnpublished = vi.fn();
    useCommunityPublishStore.getState().open(
      {
        designId: 'design-1',
        designName: 'Screw Bin',
        params,
        paramsHash: 'hash',
        publishedId: 'Pub123456789',
        lineage: null,
        draft: null,
      },
      undefined,
      { onPublished: vi.fn().mockResolvedValue(true), onUnpublished, requestRecapture: vi.fn() }
    );
    vi.mocked(getMe).mockResolvedValue(null);
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(onUnpublished).not.toHaveBeenCalled();
    expect(useCommunityPublishStore.getState().context?.publishedId).toBe('Pub123456789');
  });

  it('keeps the link when the session check fails at the network layer', async () => {
    // getMe() rejecting (offline, DNS, dropped connection) is not a confirmed
    // sign-out, so the 404 stays unconfirmed: keep the link and block the form,
    // exactly as for a null session. The rejection must be handled here, not
    // left to escape as an unhandled promise rejection.
    const onUnpublished = vi.fn();
    useCommunityPublishStore.getState().open(
      {
        designId: 'design-1',
        designName: 'Screw Bin',
        params,
        paramsHash: 'hash',
        publishedId: 'Pub123456789',
        lineage: null,
        draft: null,
      },
      undefined,
      { onPublished: vi.fn().mockResolvedValue(true), onUnpublished, requestRecapture: vi.fn() }
    );
    vi.mocked(getMe).mockRejectedValue(new TypeError('Failed to fetch'));
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(onUnpublished).not.toHaveBeenCalled();
    expect(useCommunityPublishStore.getState().context?.publishedId).toBe('Pub123456789');
  });

  it('fails closed on a server error rather than editing blind', async () => {
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'server' }));
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.prefill).toBeNull();
  });

  it('refetches on retry', async () => {
    vi.mocked(fetchOwnDesign)
      .mockResolvedValueOnce(err({ kind: 'server' }))
      .mockResolvedValueOnce(ok(record()));
    const { result } = renderHook(() => useOwnDesignPrefill('Pub123456789', 'authenticated'));
    await waitFor(() => expect(result.current.failed).toBe(true));
    result.current.retry();
    await waitFor(() => expect(result.current.prefill).not.toBeNull());
    expect(fetchOwnDesign).toHaveBeenCalledTimes(2);
  });
});
