import { afterEach, describe, expect, it, vi } from 'vitest';
import { err, OK } from '@/core/result';
import { getStaticTranslation } from '@/i18n';
import {
  checkExportUrl,
  isMixedContent,
  isValidHeaderName,
  isValidHeaderValue,
  readUrlTarget,
  sendFailureMessage,
  sendToUrl,
} from './sendToUrl';
import type { UrlTarget } from './sendToUrl';

const target: UrlTarget = {
  url: new URL('https://nas.local/upload'),
  headerName: 'X-API-Key',
  headerValue: 'secret',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkExportUrl', () => {
  it('accepts http and https addresses', () => {
    expect(checkExportUrl('https://nas.local/upload')).toBeNull();
    expect(checkExportUrl('  http://192.168.1.5:8000/drop ')).toBeNull();
  });

  it('says why anything else is rejected', () => {
    expect(checkExportUrl('nas.local/upload')).toBe('invalid');
    expect(checkExportUrl('ftp://nas.local/upload')).toBe('scheme');
    expect(checkExportUrl('javascript:alert(1)')).toBe('scheme');
  });
});

describe('isValidHeaderName', () => {
  it('allows an empty name and HTTP tokens', () => {
    expect(isValidHeaderName('')).toBe(true);
    expect(isValidHeaderName('X-API-Key')).toBe(true);
  });

  it('rejects spaces and separators', () => {
    expect(isValidHeaderName('API Key')).toBe(false);
    expect(isValidHeaderName('X-Key:')).toBe(false);
  });
});

describe('isValidHeaderValue', () => {
  it('allows printable ISO-8859-1 and rejects what fetch cannot send', () => {
    expect(isValidHeaderValue('s3cr3t-key_ä')).toBe(true);
    expect(isValidHeaderValue('\u201csecret\u201d')).toBe(false);
    expect(isValidHeaderValue('line\nbreak')).toBe(false);
  });
});

describe('isMixedContent', () => {
  it('flags an http address from an https page, except loopback', () => {
    vi.stubGlobal('location', { protocol: 'https:' });
    expect(isMixedContent(new URL('http://nas.local/upload'))).toBe(true);
    expect(isMixedContent(new URL('http://localhost:8000/upload'))).toBe(false);
    expect(isMixedContent(new URL('https://nas.local/upload'))).toBe(false);
  });

  it('never flags anything from an http page', () => {
    vi.stubGlobal('location', { protocol: 'http:' });
    expect(isMixedContent(new URL('http://nas.local/upload'))).toBe(false);
  });
});

describe('readUrlTarget', () => {
  it('trims the address and header name', () => {
    const read = readUrlTarget({
      exportUrl: ' https://nas.local/upload ',
      exportUrlHeaderName: ' X-API-Key ',
      exportUrlHeaderValue: 'secret',
    });
    expect(read?.url.href).toBe('https://nas.local/upload');
    expect(read?.headerName).toBe('X-API-Key');
  });

  it('returns null for an unusable address or header name', () => {
    const base = { exportUrlHeaderName: '', exportUrlHeaderValue: '' };
    expect(readUrlTarget({ ...base, exportUrl: '' })).toBeNull();
    expect(readUrlTarget({ ...base, exportUrl: 'file:///tmp' })).toBeNull();
    expect(
      readUrlTarget({ ...base, exportUrl: 'https://nas.local', exportUrlHeaderName: 'a b' })
    ).toBeNull();
    expect(
      readUrlTarget({
        ...base,
        exportUrl: 'https://nas.local',
        exportUrlHeaderValue: '\u201ck\u201d',
      })
    ).toBeNull();
  });
});

describe('sendToUrl', () => {
  it('POSTs the multipart fields with the header and no cookies', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendToUrl(new Blob(['solid']), 'My Bin.STL', target);

    expect(result).toEqual(OK);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe('https://nas.local/upload');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.redirect).toBe('manual');
    expect(init.headers).toEqual({ 'X-API-Key': 'secret' });
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('My Bin.STL');
    expect(await (form.get('file') as File).text()).toBe('solid');
    expect(form.get('filename')).toBe('My Bin.STL');
    expect(form.get('format')).toBe('stl');
    expect(form.get('source')).toBe('gridfinity-layout-tool');
  });

  it('sends no header when none is set', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendToUrl(new Blob(['{}']), 'layout.json', { ...target, headerName: '' });

    const init = (fetchMock.mock.calls[0] as unknown as [URL, RequestInit])[1];
    expect(init.headers).toEqual({});
  });

  it('reports the HTTP status of a refused upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 }))
    );
    expect(await sendToUrl(new Blob(['x']), 'a.stl', target)).toEqual(
      err({ reason: 'http', status: 401 })
    );
  });

  it('reports a redirect instead of following it without the file', async () => {
    const redirected = { type: 'opaqueredirect', ok: false, status: 0 } as Response;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(redirected))
    );
    expect(await sendToUrl(new Blob(['x']), 'a.stl', target)).toEqual(err({ reason: 'redirect' }));
  });

  it('reports a timeout without probing, since the file may have arrived', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendToUrl(new Blob(['x']), 'a.stl', target)).toEqual(err({ reason: 'timeout' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('calls it CORS when the server answers a no-cors probe', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendToUrl(new Blob(['x']), 'a.stl', target)).toEqual(err({ reason: 'cors' }));
    const probe = (fetchMock.mock.calls[1] as [URL, RequestInit])[1];
    expect(probe.mode).toBe('no-cors');
    expect(probe.credentials).toBe('omit');
  });

  it('calls it unreachable when the probe fails too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await sendToUrl(new Blob(['x']), 'a.stl', target)).toEqual(err({ reason: 'network' }));
  });

  it('calls it mixed content for an http address from an https page', async () => {
    vi.stubGlobal('location', { protocol: 'https:' });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendToUrl(new Blob(['x']), 'a.stl', {
      ...target,
      url: new URL('http://nas.local/upload'),
    });

    expect(result).toEqual(err({ reason: 'mixed' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('sendFailureMessage', () => {
  const t = getStaticTranslation;

  it('points at the header for 401 and 403', () => {
    expect(sendFailureMessage({ reason: 'http', status: 401 }, 'nas.local', t)).toBe(
      'Upload to nas.local failed (HTTP 401). Check the header in Settings.'
    );
    expect(sendFailureMessage({ reason: 'http', status: 403 }, 'nas.local', t)).toBe(
      'Upload to nas.local failed (HTTP 403). Check the header in Settings.'
    );
  });

  it('names the status, CORS, reachability, timeout and redirect', () => {
    expect(sendFailureMessage({ reason: 'http', status: 500 }, 'nas.local', t)).toBe(
      'Upload to nas.local failed (HTTP 500).'
    );
    expect(sendFailureMessage({ reason: 'cors' }, 'nas.local', t)).toBe(
      'Upload to nas.local was blocked or cut off. The receiver has to allow this site (CORS).'
    );
    expect(sendFailureMessage({ reason: 'network' }, 'nas.local', t)).toBe(
      "Couldn't reach nas.local. Check the address and that the receiver is running."
    );
    expect(sendFailureMessage({ reason: 'timeout' }, 'nas.local', t)).toBe(
      'Upload to nas.local timed out. It may still have reached the receiver.'
    );
    expect(sendFailureMessage({ reason: 'redirect' }, 'nas.local', t)).toBe(
      'Upload to nas.local was redirected. Use the final address in Settings.'
    );
  });
});
