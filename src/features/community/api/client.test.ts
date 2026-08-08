import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isErr, isOk } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityCard, CommunityDesignLineage } from '@/shared/types/community';
import {
  COMMUNITY_INDEX_CAP,
  fetchCommunityDesign,
  fetchCommunityIndex,
  fetchMineIndex,
  fetchOwnDesign,
  publishDesign,
  reportDesign,
  setDesignLiked,
  unpublishDesign,
  updateDesign,
} from './client';
import type { CommunityPublishInput } from './client';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const input: CommunityPublishInput = {
  name: 'Screw Bin',
  description: 'Holds screws',
  authorName: 'Andy',
  category: 'hardware',
  params: { width: 2, depth: 3, height: 6 } as unknown as BinParams,
  thumbnails: ['data:image/webp;base64,AA=='],
  glb: 'Z2xURg==',
};

const design = {
  id: 'AbCdEf123456',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Andy',
  name: 'Screw Bin',
  description: 'Holds screws',
  category: 'hardware',
  techniques: ['compartments'],
  params: { width: 2, depth: 3, height: 6 },
  metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
  lineage: null,
  thumbnails: ['https://blob/thumb-0.webp'],
  meshUrl: 'https://blob/AbCdEf123456-1.glb',
  photos: [],
  featured: false,
  createdAt: 1000,
  updatedAt: 1000,
  status: 'live',
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('publishDesign', () => {
  it('returns the id and url on 201', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { id: 'AbCdEf123456', url: 'https://x/community/AbCdEf123456' })
    );
    const result = await publishDesign(input);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({
        id: 'AbCdEf123456',
        url: 'https://x/community/AbCdEf123456',
      });
    }
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      lineage: unknown;
      name: string;
    };
    expect(body.name).toBe('Screw Bin');
    expect(body.lineage).toBeNull();
  });

  it('sends lineage when provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'AbCdEf123456', url: 'https://x' }));
    const lineage: CommunityDesignLineage = {
      parentId: 'Parent123456',
      rootId: 'Parent123456',
      parentName: 'Parent Bin',
      parentAuthorName: 'Alice',
      rootAuthorName: 'Alice',
    };
    await publishDesign(input, lineage);
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      lineage: CommunityDesignLineage;
    };
    expect(body.lineage).toEqual(lineage);
  });

  it('maps 401 to needsAuth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Authentication required', code: 'UNAUTHORIZED' })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'needsAuth' });
  });

  it('maps 503 to disabled', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, {
        error: 'Community publishing is not available.',
        code: 'SERVICE_UNAVAILABLE',
      })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'disabled' });
  });

  it('maps 429 to rateLimited with retryAfter', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter: 60 })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({ kind: 'rateLimited', retryAfterSeconds: 60 });
    }
  });

  it('maps 413 to quotaExceeded', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(413, {
        error: 'Published design limit reached (25 live designs).',
        code: 'SIZE_LIMIT',
      })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: 'quotaExceeded',
        message: 'Published design limit reached (25 live designs).',
      });
    }
  });

  it('maps 400 CONTENT_BLOCKED to contentBlocked', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'name contains prohibited content', code: 'CONTENT_BLOCKED' })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: 'contentBlocked',
        message: 'name contains prohibited content',
      });
    }
  });

  it('maps other 400 codes to validation with the server code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'name must be 1-60 characters', code: 'INVALID_NAME' })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: 'validation',
        code: 'INVALID_NAME',
        message: 'name must be 1-60 characters',
      });
    }
  });

  it('routes coded 409 conflicts (duplicate, unchanged remix, in-progress) through validation', async () => {
    for (const code of ['DUPLICATE_DESIGN', 'REMIX_UNCHANGED', 'PUBLISH_IN_PROGRESS']) {
      fetchMock.mockResolvedValue(jsonResponse(409, { error: 'conflict', code }));
      const result = await publishDesign(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({ kind: 'validation', code, message: 'conflict' });
      }
    }
  });

  it('maps 403 to forbidden with the neutral server message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: 'Publishing is not available for this account.',
        code: 'UNAUTHORIZED',
      })
    );
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        kind: 'forbidden',
        message: 'Publishing is not available for this account.',
      });
    }
  });

  it('maps a fetch rejection to network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'network' });
  });

  it('maps a malformed success body to server', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }));
    const result = await publishDesign(input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'server' });
  });
});

describe('updateDesign', () => {
  it('PUTs to the design endpoint and returns the updated design', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { design }));
    const result = await updateDesign('AbCdEf123456', input);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.id).toBe('AbCdEf123456');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('maps 404 to notFound', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: 'Design not found', code: 'NOT_FOUND' })
    );
    const result = await updateDesign('AbCdEf123456', input);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'notFound' });
  });
});

describe('unpublishDesign', () => {
  it('DELETEs the design and returns success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));
    const result = await unpublishDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('maps 401 to needsAuth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Authentication required', code: 'UNAUTHORIZED' })
    );
    const result = await unpublishDesign('AbCdEf123456');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'needsAuth' });
  });
});

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

function requestedUrl(callIndex: number): string {
  return String(fetchMock.mock.calls[callIndex]?.[0]);
}

describe('fetchCommunityIndex windowed mode', () => {
  it('requests the remainder as concurrent windows once the slot count is known', async () => {
    // 100 slots: the first sequential page covers 0-23, so windows start at
    // its cursor and stride by 48 until the count is passed.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a')], nextCursor: '24', indexSlots: 100 })
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('b')], nextCursor: '72' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('c')], nextCursor: null }));

    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestedUrl(1)).toBe('/api/community?sort=newest&cursor=24&window=48');
    expect(requestedUrl(2)).toBe('/api/community?sort=newest&cursor=72&window=48');
  });

  it('covers the index with disjoint windows rather than guessing page boundaries', async () => {
    // A window holding hidden entries returns short. That must not shorten the
    // stride, or the slots it did not yield would never be requested.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a')], nextCursor: '24', indexSlots: 130 })
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [], nextCursor: '72' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('c')], nextCursor: '120' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('d')], nextCursor: null }));

    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items.map((i) => i.id)).toEqual(['a', 'c', 'd']);
    expect(requestedUrl(1)).toBe('/api/community?sort=newest&cursor=24&window=48');
    expect(requestedUrl(2)).toBe('/api/community?sort=newest&cursor=72&window=48');
    expect(requestedUrl(3)).toBe('/api/community?sort=newest&cursor=120&window=48');
  });

  it('dedupes a card served by two windows', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a')], nextCursor: '24', indexSlots: 60 })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a'), card('b')], nextCursor: null })
      );
    const result = await fetchCommunityIndex();
    if (isOk(result)) expect(result.value.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('surfaces a window failure rather than a silently short gallery', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a')], nextCursor: '24', indexSlots: 100 })
      )
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('c')], nextCursor: null }));
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(false);
  });

  it('falls back to sequential paging when the server reports no slot count', async () => {
    // A client ahead of a deployment still loads.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('a')], nextCursor: '24' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('b')], nextCursor: null }));
    const result = await fetchCommunityIndex();
    if (isOk(result)) expect(result.value.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(requestedUrl(1)).toBe('/api/community?sort=newest&cursor=24');
  });

  it('reports the cap when the index has more slots than the cap', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a')], nextCursor: '24', indexSlots: 5000 })
      )
      .mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));
    const result = await fetchCommunityIndex();
    if (isOk(result)) expect(result.value.capped).toBe(true);
  });
});

describe('fetchCommunityIndex', () => {
  it('assembles pages until the cursor is exhausted, passing the cursor through', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('a'), card('b')], nextCursor: '48' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('c')], nextCursor: null }));
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
      expect(result.value.capped).toBe(false);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(0)).toBe('/api/community?sort=newest');
    expect(requestedUrl(1)).toBe('/api/community?sort=newest&cursor=48');
  });

  it('keeps paging past a short page with a non-null cursor', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [], nextCursor: '960' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('a')], nextCursor: '1008' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('b')], nextCursor: null }));
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items.map((item) => item.id)).toEqual(['a', 'b']);
      expect(result.value.capped).toBe(false);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('dedupes a boundary card re-served when a publish shifts the offset cursor', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('a'), card('b')], nextCursor: '48' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('b'), card('c')], nextCursor: null })
      );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    }
  });

  it('stops at the 2,000-newest cap and surfaces the cap state', async () => {
    const half = COMMUNITY_INDEX_CAP / 2;
    const pageOf = (start: number): CommunityCard[] =>
      Array.from({ length: half }, (_, i) => card(`d${start + i}`));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: pageOf(0), nextCursor: '1000' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: pageOf(half), nextCursor: '2000' }));
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items).toHaveLength(COMMUNITY_INDEX_CAP);
      expect(result.value.capped).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('trims overflow beyond the cap, keeping the newest-first prefix', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          items: Array.from({ length: COMMUNITY_INDEX_CAP - 1 }, (_, i) => card(`d${i}`)),
          nextCursor: '4000',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('x'), card('y')], nextCursor: '4048' })
      );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items).toHaveLength(COMMUNITY_INDEX_CAP);
      expect(result.value.items[COMMUNITY_INDEX_CAP - 1]?.id).toBe('x');
      expect(result.value.capped).toBe(true);
    }
  });

  it('does not report the cap when the index ends exactly at the cap', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        items: Array.from({ length: COMMUNITY_INDEX_CAP }, (_, i) => card(`d${i}`)),
        nextCursor: null,
      })
    );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.capped).toBe(false);
  });

  it('reports the cap when the index reaches it and a page still overflows in one response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        items: Array.from({ length: COMMUNITY_INDEX_CAP + 1 }, (_, i) => card(`d${i}`)),
        nextCursor: null,
      })
    );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items).toHaveLength(COMMUNITY_INDEX_CAP);
      expect(result.value.capped).toBe(true);
    }
  });

  it('reports the cap when the index ends exactly at the cap but the server still hands back a cursor', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        items: Array.from({ length: COMMUNITY_INDEX_CAP }, (_, i) => card(`d${i}`)),
        nextCursor: 'still-more',
      })
    );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items).toHaveLength(COMMUNITY_INDEX_CAP);
      expect(result.value.capped).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not claim the cap when under it', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        items: Array.from({ length: COMMUNITY_INDEX_CAP - 1 }, (_, i) => card(`d${i}`)),
        nextCursor: null,
      })
    );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items).toHaveLength(COMMUNITY_INDEX_CAP - 1);
      expect(result.value.capped).toBe(false);
    }
  });

  it('does not claim the cap when the request budget runs out below it', async () => {
    fetchMock.mockImplementation((url: string) => {
      const cursor = new URL(url, 'https://x').searchParams.get('cursor') ?? '0';
      const next = Number(cursor) + 1;
      return Promise.resolve(
        jsonResponse(200, { items: [card(`d${cursor}`)], nextCursor: String(next) })
      );
    });
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items.length).toBeLessThan(COMMUNITY_INDEX_CAP);
      expect(result.value.capped).toBe(false);
    }
  });

  it('propagates an error from a mid-pagination page', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('a')], nextCursor: '48' }))
      .mockResolvedValueOnce(
        jsonResponse(429, { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter: 30 })
      );
    const result = await fetchCommunityIndex();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({ kind: 'rateLimited', retryAfterSeconds: 30 });
    }
  });

  it('maps a malformed page body to server', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 1 }], nextCursor: null }));
    const result = await fetchCommunityIndex();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'server' });
  });

  it('maps a fetch rejection to network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await fetchCommunityIndex();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'network' });
  });
});

describe('fetchMineIndex', () => {
  it('requests the mine list and pages through it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a'), card('b')], nextCursor: '48', likedIds: ['b'] })
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [card('c')], nextCursor: null }));
    const result = await fetchMineIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
      expect(result.value.items[1]?.likedByMe).toBe(true);
      expect(result.value.capped).toBe(false);
    }
    expect(requestedUrl(0)).toBe('/api/community?sort=newest&mine=1');
    expect(requestedUrl(1)).toBe('/api/community?sort=newest&mine=1&cursor=48');
  });

  it('includes the caller-owned hidden designs the public list excludes', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { items: [card('a', { status: 'hidden' })], nextCursor: null })
    );
    const result = await fetchMineIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items[0]?.status).toBe('hidden');
  });

  it('accepts owner-only opens/views counts and the hiddenReason field', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          card('a', {
            status: 'hidden',
            hiddenReason: 'denylist',
            counts: { likes: 1, remixes: 2, exports: 3, opens: 7, views: 31 },
          }),
        ],
        nextCursor: null,
      })
    );
    const result = await fetchMineIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items[0]?.hiddenReason).toBe('denylist');
      expect(result.value.items[0]?.counts.opens).toBe(7);
      expect(result.value.items[0]?.counts.views).toBe(31);
    }
  });

  it('maps 401 to needsAuth for a signed-out caller', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: 'Sign in required', code: 'UNAUTHORIZED' })
    );
    const result = await fetchMineIndex();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'needsAuth' });
  });

  it('maps a fetch rejection to network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await fetchMineIndex();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'network' });
  });
});

describe('fetchOwnDesign', () => {
  it('GETs the design record', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { design }));
    const result = await fetchOwnDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.name).toBe('Screw Bin');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('maps 404 to notFound for unpublished or unowned designs', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: 'Design not found', code: 'NOT_FOUND' })
    );
    const result = await fetchOwnDesign('AbCdEf123456');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'notFound' });
  });
});

describe('fetchCommunityDesign', () => {
  it('returns the record with the server-verified isOwner flag', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { design, isOwner: true }));
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.design.name).toBe('Screw Bin');
      expect(result.value.isOwner).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('defaults isOwner to false when the field is absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { design }));
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.isOwner).toBe(false);
  });

  it('parses the detail counts and likedByMe for the stats-row fallback', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        design,
        isOwner: false,
        counts: { likes: 4, remixes: 2, exports: 9 },
        likedByMe: true,
      })
    );
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.counts).toEqual({ likes: 4, remixes: 2, exports: 9 });
      expect(result.value.likedByMe).toBe(true);
    }
  });

  it('parses owner-only opens/views counts and hidden moderation fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        design: { ...design, status: 'hidden' },
        isOwner: true,
        counts: { likes: 4, remixes: 2, exports: 9, opens: 7, views: 31 },
        likedByMe: false,
        hiddenReason: 'reports',
        hiddenReasonCategory: 'spam',
      })
    );
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.counts).toEqual({
        likes: 4,
        remixes: 2,
        exports: 9,
        opens: 7,
        views: 31,
      });
      expect(result.value.hiddenReason).toBe('reports');
      expect(result.value.hiddenReasonCategory).toBe('spam');
    }
  });

  it('parses a manual moderation hide reason', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        design: { ...design, status: 'hidden' },
        isOwner: true,
        hiddenReason: 'moderation',
        hiddenReasonCategory: null,
      })
    );
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.hiddenReason).toBe('moderation');
      expect(result.value.hiddenReasonCategory).toBeNull();
    }
  });

  it('nulls unknown moderation values instead of trusting them', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { design, hiddenReason: 'because', hiddenReasonCategory: 'ugly' })
    );
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.hiddenReason).toBeNull();
      expect(result.value.hiddenReasonCategory).toBeNull();
    }
  });

  it('degrades counts to null when absent or malformed (older server, no Redis)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { design, counts: { likes: 'many' } }));
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.counts).toBeNull();
      expect(result.value.likedByMe).toBe(false);
    }
  });

  it('maps 404 to notFound for hidden or removed designs', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: 'Design not found', code: 'NOT_FOUND' })
    );
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'notFound' });
  });

  it('maps a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await fetchCommunityDesign('AbCdEf123456');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'network' });
  });
});

describe('likedIds seeding', () => {
  it('marks cards from each page against that page likedIds', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('a'), card('b')], nextCursor: '48', likedIds: ['b'] })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [card('c')], nextCursor: null, likedIds: [] })
      );
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items.map((item) => item.likedByMe)).toEqual([false, true, false]);
    }
  });

  it('treats an absent likedIds field as nothing liked', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [card('a')], nextCursor: null }));
    const result = await fetchCommunityIndex();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items[0].likedByMe).toBe(false);
  });
});

describe('setDesignLiked', () => {
  it('POSTs the like action and returns the authoritative result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { likes: 13, likedByMe: true }));
    const result = await setDesignLiked('AbCdEf123456', true);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toEqual({ likes: 13, likedByMe: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'like' }) })
    );
  });

  it('POSTs the unlike action when toggling off', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { likes: 11, likedByMe: false }));
    const result = await setDesignLiked('AbCdEf123456', false);
    expect(isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ body: JSON.stringify({ action: 'unlike' }) })
    );
  });

  it('maps 401 to needsAuth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Authentication required', code: 'UNAUTHORIZED' })
    );
    const result = await setDesignLiked('AbCdEf123456', true);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'needsAuth' });
  });

  it('rejects a malformed success payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { liked: true }));
    const result = await setDesignLiked('AbCdEf123456', true);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'server' });
  });
});

describe('reportDesign', () => {
  it('POSTs the report action with reason and trimmed note', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, autoHidden: false }));
    const result = await reportDesign('AbCdEf123456', 'spam', '  keyword stuffing  ');
    expect(isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'report', reason: 'spam', note: 'keyword stuffing' }),
      })
    );
  });

  it('omits the note field entirely when the note is blank', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, autoHidden: false }));
    await reportDesign('AbCdEf123456', 'broken', '   ');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community/AbCdEf123456',
      expect.objectContaining({ body: JSON.stringify({ action: 'report', reason: 'broken' }) })
    );
  });

  it('caps the note at 500 characters before sending', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, autoHidden: false }));
    await reportDesign('AbCdEf123456', 'stolen', 'x'.repeat(600));
    const body: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect((body as { note: string }).note).toHaveLength(500);
  });

  it('maps 400 CONTENT_BLOCKED to contentBlocked', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'note contains prohibited content', code: 'CONTENT_BLOCKED' })
    );
    const result = await reportDesign('AbCdEf123456', 'spam', 'bad');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe('contentBlocked');
  });

  it('maps 401 to needsAuth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'Authentication required', code: 'UNAUTHORIZED' })
    );
    const result = await reportDesign('AbCdEf123456', 'spam', '');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toEqual({ kind: 'needsAuth' });
  });
});
