/**
 * Integration tests for Vercel Edge Middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @vercel/blob before importing middleware
vi.mock('@vercel/blob', () => ({
  head: vi.fn(),
}));

// Mock global fetch for blob content and index.html fetches
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import middleware from './middleware';
import { head } from '@vercel/blob';

const SAMPLE_INDEX_HTML = [
  '<!doctype html><html><head>',
  '<title>Gridfinity Layout Tool | Plan Your 3D Printed Drawer Organizers</title>',
  '<meta name="description" content="Default desc">',
  '<meta name="robots" content="index, follow">',
  '<meta property="og:title" content="Default OG">',
  '<meta property="og:description" content="Default OG Desc">',
  '<meta property="og:url" content="https://gridfinitylayouttool.com/">',
  '<meta name="twitter:title" content="Default Twitter">',
  '<meta name="twitter:description" content="Default Twitter Desc">',
  '</head><body><div id="root"></div></body></html>',
].join('\n');

const SAMPLE_SHARE_DATA = {
  layout: {
    name: 'My Workshop',
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [
      { id: 'l1', name: 'Bottom', height: 3 },
      { id: 'l2', name: 'Top', height: 3 },
    ],
    bins: [
      { id: 'b1', layerId: 'l1' },
      { id: 'b2', layerId: 'l1' },
      { id: 'b3', layerId: 'l2' },
      { id: 'b4', layerId: '__staging__' },
    ],
  },
  deleteTokenHash: 'abc',
  createdAt: Date.now(),
};

function createRequest(path: string, userAgent = 'Mozilla/5.0 Chrome/120.0'): Request {
  return new Request(`https://gridfinitylayouttool.com${path}`, {
    headers: { 'user-agent': userAgent },
  });
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through non-bot requests', async () => {
    const request = createRequest('/l/abc123DEF456');
    const result = await middleware(request);

    // undefined means pass through (no interception)
    expect(result).toBeUndefined();
    expect(head).not.toHaveBeenCalled();
  });

  it('returns layout-specific HTML for bot with valid share', async () => {
    vi.mocked(head).mockResolvedValue({
      url: 'https://blob.vercel-storage.com/shares/abc123DEF456.json',
      downloadUrl: 'https://blob.vercel-storage.com/shares/abc123DEF456.json',
      pathname: 'shares/abc123DEF456.json',
      contentType: 'application/json',
      contentDisposition: 'inline',
      size: 1234,
      uploadedAt: new Date(),
    });

    mockFetch
      // First call: blob content
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SHARE_DATA),
      })
      // Second call: index.html
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_INDEX_HTML),
      });

    const request = createRequest('/l/abc123DEF456', 'Twitterbot/1.0');
    const result = await middleware(request);

    expect(result).toBeInstanceOf(Response);
    const html = await result!.text();

    // Layout-specific meta tags
    expect(html).toContain('<title>My Workshop | Gridfinity Layout Tool</title>');
    expect(html).toContain('10×8 Gridfinity drawer layout');
    expect(html).toContain('3 bins'); // 4 total minus 1 staging
    expect(html).toContain('2 layers');

    // noindex for shared layouts
    expect(html).toContain('name="robots" content="noindex"');

    // Correct content type
    expect(result!.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('returns fallback HTML when share not found', async () => {
    vi.mocked(head).mockRejectedValue(new Error('Not found'));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(SAMPLE_INDEX_HTML),
    });

    const request = createRequest('/l/abc123DEF456', 'facebookexternalhit/1.1');
    const result = await middleware(request);

    expect(result).toBeInstanceOf(Response);
    const html = await result!.text();

    // Fallback with noindex
    expect(html).toContain('Shared Layout | Gridfinity Layout Tool');
    expect(html).toContain('name="robots" content="noindex"');
  });

  it('returns undefined for bot with invalid path', async () => {
    const request = createRequest('/l/', 'Twitterbot/1.0');
    const result = await middleware(request);

    expect(result).toBeUndefined();
  });

  it('handles blob fetch failure gracefully', async () => {
    vi.mocked(head).mockResolvedValue({
      url: 'https://blob.vercel-storage.com/shares/abc123DEF456.json',
      downloadUrl: 'https://blob.vercel-storage.com/shares/abc123DEF456.json',
      pathname: 'shares/abc123DEF456.json',
      contentType: 'application/json',
      contentDisposition: 'inline',
      size: 1234,
      uploadedAt: new Date(),
    });

    mockFetch
      // Blob fetch fails
      .mockResolvedValueOnce({ ok: false, status: 500 })
      // Fallback index.html
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_INDEX_HTML),
      });

    const request = createRequest('/l/abc123DEF456', 'Slackbot-LinkExpanding 1.0');
    const result = await middleware(request);

    // Should still return something (fallback HTML)
    expect(result).toBeInstanceOf(Response);
  });
});
