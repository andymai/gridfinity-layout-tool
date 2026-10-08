import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type * as Session from './session.js';

const mocks = vi.hoisted(() => ({
  readOptionalSession: vi.fn(),
  getRedis: vi.fn(),
  heldMeshUrls: vi.fn(),
}));

// The CSRF check stays real: it is what keeps an otherwise anonymous endpoint
// from vouching for a signed-in account's files on a cross-site request.
vi.mock('./session.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Session>()),
  readOptionalSession: mocks.readOptionalSession,
}));
vi.mock('./rateLimit.js', () => ({ getRedis: mocks.getRedis }));
vi.mock('./meshIndex.js', () => ({ heldMeshUrls: mocks.heldMeshUrls }));

import {
  resolveHeldMeshFiles,
  resolveShareMeshFiles,
  unvalidatedMeshRefHashes,
} from './shareMeshes.js';

const [A, B] = ['a', 'b'].map((c) => c.repeat(64));
const url = (hash: string): string => `https://store.public.blob.vercel-storage.com/meshes/${hash}`;

function request(headers: Record<string, string> = { 'x-requested-with': 'gflt' }): VercelRequest {
  return { method: 'POST', headers } as unknown as VercelRequest;
}

function response() {
  const res = {
    _status: 0,
    _body: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as VercelResponse & { _status: number; _body: unknown };
}

describe('resolveShareMeshFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRedis.mockReturnValue({});
    mocks.readOptionalSession.mockResolvedValue({ userId: 'u1' });
    mocks.heldMeshUrls.mockResolvedValue(new Map([[A, url(A)]]));
  });

  it('answers the CDN URL of each file the caller holds', async () => {
    const res = response();
    expect(await resolveShareMeshFiles(request(), res, [A, A])).toEqual({ [A]: url(A) });
    expect(mocks.heldMeshUrls).toHaveBeenCalledWith({}, 'u1', [A]);
    expect(res._status).toBe(0);
  });

  it('asks nothing of a share that names no file, a signed-out one included', async () => {
    const res = response();
    expect(await resolveShareMeshFiles(request({}), res, [])).toEqual({});
    expect(mocks.readOptionalSession).not.toHaveBeenCalled();
    expect(res._status).toBe(0);
  });

  it('answers 424 naming each file the caller does not hold', async () => {
    const res = response();
    expect(await resolveShareMeshFiles(request(), res, [A, B])).toBeNull();
    expect(res._status).toBe(424);
    expect(res._body).toMatchObject({ code: 'MESH_MISSING', missing: [B] });
  });

  it('holds nothing for a signed-out caller', async () => {
    mocks.readOptionalSession.mockResolvedValue(null);
    const res = response();
    expect(await resolveShareMeshFiles(request(), res, [A])).toBeNull();
    expect(res._body).toMatchObject({ code: 'MESH_MISSING', missing: [A] });
    expect(mocks.heldMeshUrls).not.toHaveBeenCalled();
  });

  it('refuses a request without the CSRF header before reading the session', async () => {
    const res = response();
    expect(await resolveShareMeshFiles(request({}), res, [A])).toBeNull();
    expect(res._status).toBe(403);
    expect(mocks.readOptionalSession).not.toHaveBeenCalled();
  });
});

describe('resolveHeldMeshFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.heldMeshUrls.mockResolvedValue(new Map([[A, url(A)]]));
  });

  it('answers for the given account, whose session the caller already checked', async () => {
    const res = response();
    expect(await resolveHeldMeshFiles(res, {} as never, 'u1', [A])).toEqual({ [A]: url(A) });
    expect(mocks.heldMeshUrls).toHaveBeenCalledWith({}, 'u1', [A]);
  });

  it('answers 424 naming each file the account does not hold', async () => {
    const res = response();
    expect(await resolveHeldMeshFiles(res, {} as never, 'u1', [A, B])).toBeNull();
    expect(res._status).toBe(424);
    expect(res._body).toMatchObject({ code: 'MESH_MISSING', missing: [B] });
  });
});

describe('unvalidatedMeshRefHashes', () => {
  it('reads each well-formed ref hash once, ignoring inline assets and junk', () => {
    const body = {
      params: {
        meshAssets: {
          a: { hash: A },
          b: { hash: A },
          c: { hash: 'NOT-HEX' },
          d: { data: 'AAAA' },
          e: 'junk',
        },
      },
    };
    expect(unvalidatedMeshRefHashes(body)).toEqual([A]);
  });

  it('reads nothing from a body without params', () => {
    expect(unvalidatedMeshRefHashes(null)).toEqual([]);
    expect(unvalidatedMeshRefHashes({ params: 'x' })).toEqual([]);
  });
});
