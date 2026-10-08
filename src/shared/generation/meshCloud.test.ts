import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESH_URL_HEADER as API_MESH_URL_HEADER } from '../../../api/meshes/[hash].js';
import {
  MESH_URL_HEADER,
  __resetMeshCloudForTests,
  beginMeshCloudSession,
  endMeshCloudSession,
  fetchMeshFiles,
  fetchSharedMeshFiles,
  meshCloudSession,
  forgetHeldMeshes,
  uploadMeshFiles,
} from './meshCloud';
import { __resetMeshStoreForTests, getMeshFile, hasMeshFile, putMeshFile } from './meshStore';
import { sha256Hex } from './sha256';

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
  return fetchMock.mock.calls.map(([url, init]) => ({ method: init?.method, url }));
}

beforeEach(async () => {
  __resetMeshCloudForTests();
  __resetMeshStoreForTests();
  await deleteDb('gridfinity-mesh-files');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  __resetMeshCloudForTests();
  vi.useRealTimers();
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

  it('answers unavailable when the server has no mesh store, then stops asking', async () => {
    const file = await storedFile(6);
    const other = await storedFile(9);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    expect(await uploadMeshFiles([file.hash])).toEqual({ status: 'unavailable' });
    expect(await uploadMeshFiles([other.hash])).toEqual({ status: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects while offline, as a push does, and asks again next time', async () => {
    const file = await storedFile(8);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(uploadMeshFiles([file.hash])).rejects.toThrow('Failed to fetch');

    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
    expect(await uploadMeshFiles([file.hash])).toEqual({ status: 'held' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers throttled, with the delay the server gave, on a 429', async () => {
    const file = await storedFile(10);
    fetchMock.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '30' } })
    );

    expect(await uploadMeshFiles([file.hash])).toEqual({
      status: 'throttled',
      retryAfterMs: 30_000,
    });
  });

  it('answers refused, and stops offering for a while, a file the server will not take', async () => {
    const file = await storedFile(11);
    const held = await storedFile(12);
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method !== 'HEAD') return new Response(null, { status: 413 });
      return new Response(null, { status: url.endsWith(held.hash) ? 200 : 404 });
    });

    const refused = { status: 'refused', hashes: [file.hash] };
    expect(await uploadMeshFiles([file.hash, held.hash])).toEqual(refused);
    expect(await uploadMeshFiles([file.hash, held.hash])).toEqual(refused);
    expect(calls().filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('forgets what the account refused when its session ends', async () => {
    const file = await storedFile(13);
    fetchMock.mockImplementation(
      async (_url, init) => new Response(null, { status: init?.method === 'HEAD' ? 404 : 413 })
    );
    expect((await uploadMeshFiles([file.hash])).status).toBe('refused');

    endMeshCloudSession();
    beginMeshCloudSession();
    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));

    expect(await uploadMeshFiles([file.hash])).toEqual({ status: 'held' });
  });

  it('starts no upload between one session and the next', async () => {
    const file = await storedFile(15);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    endMeshCloudSession();
    await expect(uploadMeshFiles([file.hash])).rejects.toThrow('session ended');
    expect(fetchMock).not.toHaveBeenCalled();

    beginMeshCloudSession();
    expect(await uploadMeshFiles([file.hash])).toEqual({ status: 'held' });
  });

  it('takes an upload no further once its session ends', async () => {
    const file = await storedFile(14);
    let answerHead = (_res: Response): void => undefined;
    fetchMock.mockImplementation((_url, init) =>
      init?.method === 'HEAD'
        ? new Promise((resolve) => {
            answerHead = resolve;
          })
        : Promise.resolve(new Response(null, { status: 200 }))
    );

    const uploading = uploadMeshFiles([file.hash]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    endMeshCloudSession();
    answerHead(new Response(null, { status: 404 }));

    await expect(uploading).rejects.toThrow('session ended');
    expect(calls().map((c) => c.method)).toEqual(['HEAD']);
  });

  it('abandons an upload whose request hangs, freeing its slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const file = await storedFile(15);
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
        })
    );

    const uploading = uploadMeshFiles([file.hash]);
    const settled = expect(uploading).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000);
    await settled;

    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
    expect(await uploadMeshFiles([file.hash])).toEqual({ status: 'held' });
  });

  it('refuses an upload for a push begun under an earlier session', async () => {
    const file = await storedFile(16);
    const earlier = meshCloudSession();
    endMeshCloudSession();
    beginMeshCloudSession();

    await expect(uploadMeshFiles([file.hash], earlier)).rejects.toThrow('session ended');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers held without a request for a payload with no mesh', async () => {
    expect(await uploadMeshFiles([])).toEqual({ status: 'held' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads a few files at a time across every push', async () => {
    const files = await Promise.all([60, 61, 62, 63, 64, 65, 66, 67].map(storedFile));
    let open = 0;
    let most = 0;
    fetchMock.mockImplementation(async (_url, init) => {
      open++;
      most = Math.max(most, open);
      await new Promise((resolve) => setTimeout(resolve, 1));
      open--;
      return new Response(null, { status: init?.method === 'HEAD' ? 404 : 200 });
    });

    const results = await Promise.all(files.map((f) => uploadMeshFiles([f.hash])));

    expect(results.every((r) => r.status === 'held')).toBe(true);
    expect(most).toBeLessThanOrEqual(4);
    expect(calls().filter((c) => c.method === 'PUT')).toHaveLength(files.length);
  });

  it('refuses an upload that waited past its session, and frees every slot for the next', async () => {
    const stalled = await Promise.all([70, 71, 72, 73, 74].map(storedFile));
    const answers: ((res: Response) => void)[] = [];
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        })
    );
    const uploading = stalled.map((f) => uploadMeshFiles([f.hash]));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    endMeshCloudSession();
    beginMeshCloudSession();

    await expect(uploading[4]).rejects.toThrow('session ended');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
    const next = await Promise.all([75, 76, 77, 78].map(storedFile));
    expect(await uploadMeshFiles(next.map((f) => f.hash))).toEqual({ status: 'held' });

    for (const answer of answers) answer(new Response(null, { status: 404 }));
    const settled = await Promise.allSettled(uploading.slice(0, 4));
    expect(settled.every((s) => s.status === 'rejected')).toBe(true);
  });
});

describe('fetchMeshFiles', () => {
  const CDN = 'https://store.public.blob.vercel-storage.com/meshes/';

  async function remoteFile(seed: number): Promise<{ hash: string; bytes: Uint8Array }> {
    const bytes = new Uint8Array([seed, 9, 8, 7, 6, 5, 4, 3]);
    return { hash: await sha256Hex(bytes), bytes };
  }

  /** The account holds `files`; the CDN answers each under its hash. */
  function serve(files: ReadonlyMap<string, Uint8Array>): void {
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'HEAD') {
        const hash = url.slice('/api/meshes/'.length);
        return files.has(hash)
          ? new Response(null, { status: 200, headers: { [MESH_URL_HEADER]: CDN + hash } })
          : new Response(null, { status: 404 });
      }
      const body = files.get(url.slice(CDN.length));
      return body
        ? new Response(body.slice(), { status: 200 })
        : new Response(null, { status: 404 });
    });
  }

  it('reads the header the server sends the file URL in', () => {
    expect(MESH_URL_HEADER).toBe(API_MESH_URL_HEADER);
  });

  it('stores a file this device lacks from the URL the server gives', async () => {
    const file = await remoteFile(1);
    serve(new Map([[file.hash, file.bytes]]));

    await fetchMeshFiles([file.hash]);

    expect(calls()).toEqual([
      { method: 'HEAD', url: `/api/meshes/${file.hash}` },
      { method: undefined, url: CDN + file.hash },
    ]);
    expect(await getMeshFile(file.hash)).toEqual(file.bytes);
  });

  it('refuses bytes that are not the file their name says', async () => {
    const file = await remoteFile(2);
    const other = await remoteFile(3);
    serve(new Map([[file.hash, other.bytes]]));

    await fetchMeshFiles([file.hash]);

    expect(await hasMeshFile(file.hash)).toBe(false);
    expect(await hasMeshFile(other.hash)).toBe(false);
  });

  it('asks nothing for a file already on this device', async () => {
    const file = await storedFile(4);

    await fetchMeshFiles([file.hash]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches a file once however often it is asked for', async () => {
    const file = await remoteFile(5);
    serve(new Map([[file.hash, file.bytes]]));

    await Promise.all([fetchMeshFiles([file.hash, file.hash]), fetchMeshFiles([file.hash])]);

    expect(calls().map((c) => c.method)).toEqual(['HEAD', undefined]);
  });

  it('tries a failed file again on its own a minute later, and not before', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const file = await remoteFile(6);
    serve(new Map());
    await fetchMeshFiles([file.hash]);
    expect(calls()).toEqual([{ method: 'HEAD', url: `/api/meshes/${file.hash}` }]);

    await fetchMeshFiles([file.hash]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    serve(new Map([[file.hash, file.bytes]]));
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.waitFor(async () => expect(await hasMeshFile(file.hash)).toBe(true));
  });

  it('downloads a few files at a time', async () => {
    const files = await Promise.all([20, 21, 22, 23, 24, 25, 26, 27].map(remoteFile));
    serve(new Map(files.map((f) => [f.hash, f.bytes])));
    const served = fetchMock.getMockImplementation();
    let open = 0;
    let most = 0;
    fetchMock.mockImplementation(async (url, init) => {
      open++;
      most = Math.max(most, open);
      await new Promise((resolve) => setTimeout(resolve, 1));
      open--;
      if (!served) throw new Error('fixture');
      return served(url, init);
    });

    await fetchMeshFiles(files.map((f) => f.hash));

    expect(most).toBeLessThanOrEqual(4);
    for (const f of files) expect(await hasMeshFile(f.hash)).toBe(true);
  });

  it('shares four downloads at a time across every caller', async () => {
    const files = await Promise.all([40, 41, 42, 43, 44, 45, 46, 47].map(remoteFile));
    serve(new Map(files.map((f) => [f.hash, f.bytes])));
    const served = fetchMock.getMockImplementation();
    let open = 0;
    let most = 0;
    fetchMock.mockImplementation(async (url, init) => {
      open++;
      most = Math.max(most, open);
      await new Promise((resolve) => setTimeout(resolve, 1));
      open--;
      if (!served) throw new Error('fixture');
      return served(url, init);
    });

    await Promise.all(files.map((f) => fetchMeshFiles([f.hash])));

    expect(most).toBeLessThanOrEqual(4);
    for (const f of files) expect(await hasMeshFile(f.hash)).toBe(true);
  });

  it('lets a longer throttle push back a retry already scheduled', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const failing = await remoteFile(50);
    const throttled = await remoteFile(51);
    serve(new Map());
    await fetchMeshFiles([failing.hash]);
    fetchMock.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '1800' } })
    );
    await fetchMeshFiles([throttled.hash]);
    const asked = fetchMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(asked);

    serve(
      new Map([
        [failing.hash, failing.bytes],
        [throttled.hash, throttled.bytes],
      ])
    );
    await vi.advanceTimersByTimeAsync(1_740_000);
    await vi.waitFor(async () => expect(await hasMeshFile(throttled.hash)).toBe(true));
  });

  it('ignores downloads asked for under an earlier session', async () => {
    const file = await remoteFile(53);
    serve(new Map([[file.hash, file.bytes]]));
    const earlier = meshCloudSession();
    endMeshCloudSession();
    beginMeshCloudSession();

    await fetchMeshFiles([file.hash], earlier);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await hasMeshFile(file.hash)).toBe(false);
  });

  it('drops the retry when the signed-in session ends', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const file = await remoteFile(52);
    serve(new Map());
    await fetchMeshFiles([file.hash]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    endMeshCloudSession();
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks nothing more for a download whose session ended while it read this device', async () => {
    const file = await remoteFile(54);
    serve(new Map([[file.hash, file.bytes]]));

    const fetching = fetchMeshFiles([file.hash]);
    endMeshCloudSession();
    beginMeshCloudSession();
    await fetching;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await hasMeshFile(file.hash)).toBe(false);
  });

  it('fetches and stores nothing once its session ends during the HEAD', async () => {
    const file = await remoteFile(55);
    serve(new Map([[file.hash, file.bytes]]));
    const served = fetchMock.getMockImplementation();
    let answerHead: () => void = () => undefined;
    fetchMock.mockImplementationOnce((url, init) => {
      if (!served) throw new Error('fixture');
      return new Promise((resolve) => {
        answerHead = () => resolve(served(url, init));
      });
    });

    const fetching = fetchMeshFiles([file.hash]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    endMeshCloudSession();
    beginMeshCloudSession();
    answerHead();
    await fetching;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(calls()).toEqual([{ method: 'HEAD', url: `/api/meshes/${file.hash}` }]);
    expect(await hasMeshFile(file.hash)).toBe(false);
  });

  it('stores nothing once its session ends while the file downloads', async () => {
    const file = await remoteFile(56);
    serve(new Map([[file.hash, file.bytes]]));
    const served = fetchMock.getMockImplementation();
    let answerCdn: () => void = () => undefined;
    fetchMock.mockImplementation((url, init) => {
      if (!served) throw new Error('fixture');
      if (init?.method === 'HEAD') return served(url, init);
      return new Promise((resolve) => {
        answerCdn = () => resolve(served(url, init));
      });
    });

    const fetching = fetchMeshFiles([file.hash]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    endMeshCloudSession();
    beginMeshCloudSession();
    answerCdn();
    await fetching;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await hasMeshFile(file.hash)).toBe(false);
  });

  it('starts nothing for a pull finishing after its session ended, until the next begins', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const file = await remoteFile(53);
    serve(new Map());

    endMeshCloudSession();
    await fetchMeshFiles([file.hash]);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(fetchMock).not.toHaveBeenCalled();

    beginMeshCloudSession();
    serve(new Map([[file.hash, file.bytes]]));
    await fetchMeshFiles([file.hash]);
    expect(await hasMeshFile(file.hash)).toBe(true);
  });

  it('waits out a throttled server before asking for the rest', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const files = await Promise.all([30, 31, 32, 33, 34, 35].map(remoteFile));
    fetchMock.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '30' } })
    );

    await fetchMeshFiles(files.map((f) => f.hash));
    const asked = fetchMock.mock.calls.length;
    expect(asked).toBeLessThanOrEqual(4);

    serve(new Map(files.map((f) => [f.hash, f.bytes])));
    await vi.advanceTimersByTimeAsync(29_000);
    expect(fetchMock).toHaveBeenCalledTimes(asked);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(async () => {
      for (const f of files) expect(await hasMeshFile(f.hash)).toBe(true);
    });
  });

  it('settles quietly when the network is down', async () => {
    const file = await remoteFile(7);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchMeshFiles([file.hash])).resolves.toBeUndefined();
    expect(await hasMeshFile(file.hash)).toBe(false);
  });
});

describe('fetchSharedMeshFiles', () => {
  const CDN = 'https://store.public.blob.vercel-storage.com/meshes/';

  async function remoteFile(seed: number): Promise<{ hash: string; bytes: Uint8Array }> {
    const bytes = new Uint8Array([seed, 7, 7, 7, 6, 5, 4, 3]);
    return { hash: await sha256Hex(bytes), bytes };
  }

  /** The CDN answers each file under its hash; the API answers nothing. */
  function serveCdn(files: ReadonlyMap<string, Uint8Array>): void {
    fetchMock.mockImplementation(async (url) => {
      const body = url.startsWith(CDN) ? files.get(url.slice(CDN.length)) : undefined;
      return body
        ? new Response(body.slice(), { status: 200 })
        : new Response(null, { status: 404 });
    });
  }

  it('stores each file straight from the URL the share gives, asking no account', async () => {
    const a = await remoteFile(1);
    const b = await remoteFile(2);
    serveCdn(
      new Map([
        [a.hash, a.bytes],
        [b.hash, b.bytes],
      ])
    );

    await fetchSharedMeshFiles({ [a.hash]: CDN + a.hash, [b.hash]: CDN + b.hash });

    expect(calls().every(({ url }) => url.startsWith(CDN))).toBe(true);
    expect(await getMeshFile(a.hash)).toEqual(a.bytes);
    expect(await getMeshFile(b.hash)).toEqual(b.bytes);
  });

  it('works between sessions, for a signed-out recipient', async () => {
    const file = await remoteFile(3);
    serveCdn(new Map([[file.hash, file.bytes]]));
    endMeshCloudSession();

    await fetchSharedMeshFiles({ [file.hash]: CDN + file.hash });

    expect(await hasMeshFile(file.hash)).toBe(true);
  });

  it('refuses bytes that are not the file their name says', async () => {
    const file = await remoteFile(4);
    const other = await remoteFile(5);
    serveCdn(new Map([[file.hash, other.bytes]]));

    await fetchSharedMeshFiles({ [file.hash]: CDN + file.hash });

    expect(await hasMeshFile(file.hash)).toBe(false);
    expect(await hasMeshFile(other.hash)).toBe(false);
  });

  it('asks nothing for a file already on this device', async () => {
    const file = await storedFile(6);

    await fetchSharedMeshFiles({ [file.hash]: CDN + file.hash });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a later sync download use the share's URL instead of asking the account", async () => {
    const file = await remoteFile(7);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await fetchSharedMeshFiles({ [file.hash]: CDN + file.hash });
    serveCdn(new Map([[file.hash, file.bytes]]));
    fetchMock.mockClear();

    await fetchMeshFiles([file.hash]);

    expect(calls()).toEqual([{ method: undefined, url: CDN + file.hash }]);
    expect(await hasMeshFile(file.hash)).toBe(true);
  });

  it('settles quietly when the network is down', async () => {
    const file = await remoteFile(8);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchSharedMeshFiles({ [file.hash]: CDN + file.hash })).resolves.toBeUndefined();
    expect(await hasMeshFile(file.hash)).toBe(false);
  });
});
