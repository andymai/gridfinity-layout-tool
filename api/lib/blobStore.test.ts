import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as VercelBlobModule from '@vercel/blob';

const mockPut = vi.fn();
const mockHead = vi.fn();
const mockDel = vi.fn();

// Use the real BlobNotFoundError class so `instanceof` checks behave the
// same as in production. Only the SDK functions are mocked.
vi.mock('@vercel/blob', async () => {
  const actual = await vi.importActual<typeof VercelBlobModule>('@vercel/blob');
  return {
    ...actual,
    put: (...args: unknown[]) => mockPut(...args),
    head: (...args: unknown[]) => mockHead(...args),
    del: (...args: unknown[]) => mockDel(...args),
  };
});

import { BlobNotFoundError } from '@vercel/blob';
import { putJson, getJson, headBlob, deleteBlob } from './blobStore';

describe('blobStore', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockHead.mockReset();
    mockDel.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('putJson', () => {
    it('serializes the value and uses public/json defaults', async () => {
      mockPut.mockResolvedValue({ url: 'https://blob/x.json', pathname: 'x.json' });

      await putJson('x.json', { hello: 'world' });

      expect(mockPut).toHaveBeenCalledWith('x.json', '{"hello":"world"}', {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
    });

    it('honors allowOverwrite + addRandomSuffix when provided', async () => {
      mockPut.mockResolvedValue({ url: 'https://blob/x.json', pathname: 'x.json' });

      await putJson('x.json', { a: 1 }, { allowOverwrite: true, addRandomSuffix: true });

      expect(mockPut).toHaveBeenCalledWith('x.json', '{"a":1}', {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: true,
        allowOverwrite: true,
      });
    });

    it('returns the PutBlobResult from @vercel/blob', async () => {
      const blobResult = {
        url: 'https://blob/x.json',
        pathname: 'x.json',
        contentType: 'application/json',
      };
      mockPut.mockResolvedValue(blobResult);

      await expect(putJson('x.json', {})).resolves.toBe(blobResult);
    });

    it('serializes nested structures correctly', async () => {
      mockPut.mockResolvedValue({ url: 'u', pathname: 'p' });
      await putJson('x.json', { a: [1, 2, { b: true }], c: null });
      expect(mockPut).toHaveBeenCalledWith(
        'x.json',
        '{"a":[1,2,{"b":true}],"c":null}',
        expect.any(Object)
      );
    });
  });

  describe('getJson', () => {
    it('returns null when head() throws BlobNotFoundError', async () => {
      mockHead.mockRejectedValue(new BlobNotFoundError());
      expect(await getJson('missing.json')).toBeNull();
    });

    it('propagates non-404 head() errors (e.g. service outage)', async () => {
      mockHead.mockRejectedValue(new Error('Connection timeout'));
      await expect(getJson('x.json')).rejects.toThrow('Connection timeout');
    });

    it('propagates non-BlobNotFoundError typed errors', async () => {
      class BlobAccessError extends Error {
        constructor() {
          super('Access denied');
        }
      }
      mockHead.mockRejectedValue(new BlobAccessError());
      await expect(getJson('x.json')).rejects.toThrow('Access denied');
    });

    it('returns parsed JSON on a successful fetch', async () => {
      mockHead.mockResolvedValue({ url: 'https://blob/x.json' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ hello: 'world' }),
      });

      expect(await getJson<{ hello: string }>('x.json')).toEqual({ hello: 'world' });
    });

    it('returns null when fetch returns 404', async () => {
      mockHead.mockResolvedValue({ url: 'https://blob/x.json' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      expect(await getJson('x.json')).toBeNull();
    });

    it('throws on non-404 fetch failures', async () => {
      mockHead.mockResolvedValue({ url: 'https://blob/x.json' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      await expect(getJson('x.json')).rejects.toThrow(/500.*Server Error/);
    });

    it('thrown error message does not include the blob path (no PII leak)', async () => {
      mockHead.mockResolvedValue({ url: 'https://blob/sensitive.json' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      try {
        await getJson('users/sensitive-user-id/layouts/secret-layout.json');
        throw new Error('expected to throw');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        expect(msg).not.toContain('sensitive-user-id');
        expect(msg).not.toContain('secret-layout');
        expect(msg).toContain('500');
      }
    });

    it('propagates fetch network errors', async () => {
      mockHead.mockResolvedValue({ url: 'https://blob/x.json' });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

      await expect(getJson('x.json')).rejects.toThrow('network down');
    });
  });

  describe('headBlob', () => {
    it('returns the head result on success', async () => {
      const meta = { url: 'https://blob/x.json', size: 123, uploadedAt: new Date() };
      mockHead.mockResolvedValue(meta);
      expect(await headBlob('x.json')).toBe(meta);
    });

    it('returns null when head() throws BlobNotFoundError', async () => {
      mockHead.mockRejectedValue(new BlobNotFoundError());
      expect(await headBlob('x.json')).toBeNull();
    });

    it('propagates non-404 head() errors', async () => {
      mockHead.mockRejectedValue(new Error('Service unavailable'));
      await expect(headBlob('x.json')).rejects.toThrow('Service unavailable');
    });
  });

  describe('deleteBlob', () => {
    it('forwards to del()', async () => {
      mockDel.mockResolvedValue(undefined);
      await deleteBlob('x.json');
      expect(mockDel).toHaveBeenCalledWith('x.json');
    });

    it('propagates errors from del()', async () => {
      mockDel.mockRejectedValue(new Error('blob storage down'));
      await expect(deleteBlob('x.json')).rejects.toThrow('blob storage down');
    });
  });
});
