import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetMeshCloudForTests, forgetHeldMeshes, uploadMeshFiles } from './meshCloud';
import { __resetMeshStoreForTests, putMeshFile } from './meshStore';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function storedFile(seed: number): Promise<{ hash: string; bytes: Uint8Array }> {
  const bytes = new Uint8Array([seed, 1, 2, 3, 4, 5, 6, 7]);
  const hash = await putMeshFile(bytes);
  if (!hash) throw new Error('fixture');
  return { hash, bytes };
}

function calls(): { method: string | undefined; url: string }[] {
  return fetchMock.mock.calls.map(([url, init]) => ({ method: init?.method, url: url }));
}

beforeEach(async () => {
  __resetMeshCloudForTests();
  __resetMeshStoreForTests();
  await deleteDb('gridfinity-mesh-files');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadMeshFiles', () => {
  it('uploads the files the account lacks and skips the ones it holds', async () => {
    const lacked = await storedFile(1);
    const held = await storedFile(2);
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'HEAD') {
        return new Response(null, { status: url.endsWith(held.hash) ? 200 : 404 });
      }
      return new Response('{}', { status: 200 });
    });

    expect(await uploadMeshFiles([lacked.hash, held.hash, lacked.hash])).toEqual({
      status: 'held',
    });

    expect(calls()).toEqual([
      { method: 'HEAD', url: `/api/meshes/${lacked.hash}` },
      { method: 'HEAD', url: `/api/meshes/${held.hash}` },
      { method: 'PUT', url: `/api/meshes/${lacked.hash}` },
    ]);
    const put = fetchMock.mock.calls[2][1];
    expect(new Headers(put?.headers).get('Content-Type')).toBe('application/octet-stream');
    expect(put?.body).toEqual(lacked.bytes);
  });

  it('asks again only for a file the server says it lacks', async () => {
    const a = await storedFile(3);
    const b = await storedFile(4);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await uploadMeshFiles([a.hash, b.hash]);
    fetchMock.mockClear();

    await uploadMeshFiles([a.hash, b.hash]);
    expect(fetchMock).not.toHaveBeenCalled();

    forgetHeldMeshes([b.hash]);
    await uploadMeshFiles([a.hash, b.hash]);
    expect(calls()).toEqual([{ method: 'HEAD', url: `/api/meshes/${b.hash}` }]);
  });

  it('shares one upload between pushes naming the same file', async () => {
    const file = await storedFile(5);
    fetchMock.mockImplementation(
      async (_url, init) => new Response(null, { status: init?.method === 'HEAD' ? 404 : 200 })
    );

    await Promise.all([uploadMeshFiles([file.hash]), uploadMeshFiles([file.hash])]);

    expect(calls().map((c) => c.method)).toEqual(['HEAD', 'PUT']);
  });

  it('answers unavailable when the server has no mesh store', async () => {
    const file = await storedFile(6);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    expect(await uploadMeshFiles([file.hash])).toEqual({ status: 'unavailable' });
  });

  it('answers missing for a file on neither the server nor this device', async () => {
    const hash = 'f'.repeat(64);
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    expect(await uploadMeshFiles([hash])).toEqual({ status: 'missing', hash });
    expect(calls().map((c) => c.method)).toEqual(['HEAD']);
  });

  it('answers failed, and tries again next time, when an upload fails', async () => {
    const file = await storedFile(7);
    fetchMock.mockImplementation(
      async (_url, init) => new Response(null, { status: init?.method === 'HEAD' ? 404 : 500 })
    );
    expect(await uploadMeshFiles([file.hash])).toEqual({
      status: 'failed',
      reason: 'mesh upload: HTTP 500',
    });

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const offline = await uploadMeshFiles([file.hash]);
    expect(offline.status).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('answers held without a request for a payload with no mesh', async () => {
    expect(await uploadMeshFiles([])).toEqual({ status: 'held' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
