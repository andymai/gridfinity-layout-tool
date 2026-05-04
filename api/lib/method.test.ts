import { describe, it, expect } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from './method';

interface TestResponse extends VercelResponse {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
  _ended: boolean;
}

function createMockResponse(): TestResponse {
  const res = {
    _status: 0,
    _body: null as unknown,
    _headers: {} as Record<string, string>,
    _ended: false,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    end() {
      this._ended = true;
      return this;
    },
    setHeader(key: string, value: string) {
      this._headers[key] = value;
      return this;
    },
  };
  return res as unknown as TestResponse;
}

function req(method: string): VercelRequest {
  return { method, headers: {} } as unknown as VercelRequest;
}

describe('requireMethod', () => {
  it('returns true when method is in the allowed list', () => {
    const res = createMockResponse();
    expect(requireMethod(req('GET'), res, ['GET', 'POST'])).toBe(true);
    expect(res._status).toBe(0);
  });

  it('returns false and sends 405 for a disallowed method', () => {
    const res = createMockResponse();
    expect(requireMethod(req('DELETE'), res, ['GET', 'POST'])).toBe(false);
    expect(res._status).toBe(405);
    expect(res._headers.Allow).toBe('GET, POST');
    expect(res._body).toMatchObject({ code: 'METHOD_NOT_ALLOWED' });
  });

  it('returns false and sends 200 for OPTIONS preflight', () => {
    const res = createMockResponse();
    expect(requireMethod(req('OPTIONS'), res, ['GET', 'POST'])).toBe(false);
    expect(res._status).toBe(200);
    expect(res._headers.Allow).toBe('GET, POST');
    expect(res._ended).toBe(true);
  });

  it('handles a single allowed method', () => {
    const res = createMockResponse();
    expect(requireMethod(req('POST'), res, ['POST'])).toBe(true);
    expect(requireMethod(req('GET'), createMockResponse(), ['POST'])).toBe(false);
  });

  it('rejects when req.method is undefined', () => {
    const res = createMockResponse();
    const r = { method: undefined, headers: {} } as unknown as VercelRequest;
    expect(requireMethod(r, res, ['GET'])).toBe(false);
    expect(res._status).toBe(405);
  });
});
