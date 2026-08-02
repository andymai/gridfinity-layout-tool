import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isErr, isOk } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignLineage } from '@/shared/types/community';
import { fetchOwnDesign, publishDesign, unpublishDesign, updateDesign } from './client';
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
