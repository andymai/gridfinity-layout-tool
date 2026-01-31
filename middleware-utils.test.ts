/**
 * Tests for middleware utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  isBotUserAgent,
  extractShareId,
  buildShareMeta,
  injectMetaTags,
  escapeHtml,
} from './middleware-utils';

describe('isBotUserAgent', () => {
  it.each([
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Facebook'],
    ['Twitterbot/1.0', 'Twitter'],
    ['Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'Slack'],
    ['LinkedInBot/1.0 (compatible; Mozilla/5.0)', 'LinkedIn'],
    ['Discordbot/2.0', 'Discord'],
    ['WhatsApp/2.21.4.22 A', 'WhatsApp'],
    ['TelegramBot (like TwitterBot)', 'Telegram'],
    ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'Googlebot'],
    ['Mozilla/5.0 (compatible; bingbot/2.0)', 'Bing'],
    ['Applebot/0.1', 'Apple'],
    ['Embedly/0.2', 'Embedly'],
    ['Pinterest/0.2', 'Pinterest'],
  ])('returns true for %s (%s)', (ua) => {
    expect(isBotUserAgent(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    '',
  ])('returns false for regular browser: %s', (ua) => {
    expect(isBotUserAgent(ua)).toBe(false);
  });
});

describe('extractShareId', () => {
  it('extracts 12-char alphanumeric ID', () => {
    expect(extractShareId('/l/abc123DEF456')).toBe('abc123DEF456');
  });

  it('extracts 12-char ID with slug', () => {
    expect(extractShareId('/l/abc123DEF456/my-layout-name')).toBe('abc123DEF456');
  });

  it('extracts UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(extractShareId(`/l/${uuid}`)).toBe(uuid);
  });

  it('extracts UUID with slug', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(extractShareId(`/l/${uuid}/my-layout`)).toBe(uuid);
  });

  it('extracts base36 timestamp ID', () => {
    expect(extractShareId('/l/lszwz1k7v-8j2kqp1')).toBe('lszwz1k7v-8j2kqp1');
  });

  it('returns null for non-matching paths', () => {
    expect(extractShareId('/')).toBeNull();
    expect(extractShareId('/about')).toBeNull();
    expect(extractShareId('/l/')).toBeNull();
  });

  it('returns null for invalid ID format', () => {
    expect(extractShareId('/l/too-short')).toBeNull();
    expect(extractShareId('/l/has spaces!')).toBeNull();
  });
});

describe('buildShareMeta', () => {
  it('builds meta from a complete layout', () => {
    const layout = {
      name: 'Workshop Drawer',
      drawer: { width: 10, depth: 8, height: 12 },
      layers: [{ id: '1', name: 'Bottom', height: 3 }],
      bins: [
        { id: 'b1', layerId: 'layer1' },
        { id: 'b2', layerId: 'layer1' },
        { id: 'b3', layerId: '__staging__' },
      ],
    };

    const result = buildShareMeta(layout);

    expect(result.title).toBe('Workshop Drawer | Gridfinity Layout Tool');
    expect(result.description).toContain('10\u00D78');
    expect(result.description).toContain('2 bins');
    expect(result.description).toContain('1 layers');
  });

  it('uses default title when name is missing', () => {
    const layout = {
      drawer: { width: 5, depth: 5, height: 10 },
      layers: [],
      bins: [],
    };

    const result = buildShareMeta(layout);
    expect(result.title).toBe('Shared Layout | Gridfinity Layout Tool');
  });

  it('uses default title when name is empty', () => {
    const layout = {
      name: '   ',
      drawer: { width: 5, depth: 5, height: 10 },
      layers: [],
      bins: [],
    };

    const result = buildShareMeta(layout);
    expect(result.title).toBe('Shared Layout | Gridfinity Layout Tool');
  });

  it('uses default description when drawer is missing', () => {
    const layout = { name: 'Test', layers: [], bins: [] };
    const result = buildShareMeta(layout);
    expect(result.description).toContain('View this shared');
  });

  it('returns defaults for null input', () => {
    const result = buildShareMeta(null);
    expect(result.title).toBe('Shared Layout | Gridfinity Layout Tool');
    expect(result.description).toContain('View this shared');
  });

  it('returns defaults for non-object input', () => {
    const result = buildShareMeta('not an object');
    expect(result.title).toBe('Shared Layout | Gridfinity Layout Tool');
  });

  it('truncates long names at 60 characters', () => {
    const layout = {
      name: 'A'.repeat(80),
      drawer: { width: 10, depth: 8, height: 12 },
      layers: [],
      bins: [],
    };

    const result = buildShareMeta(layout);
    expect(result.title).toBe('A'.repeat(60) + ' | Gridfinity Layout Tool');
  });
});

describe('injectMetaTags', () => {
  const sampleHtml = [
    '<html><head>',
    '<title>Gridfinity Layout Tool | Plan Your 3D Printed Drawer Organizers</title>',
    '<meta name="description" content="Original description">',
    '<meta name="robots" content="index, follow">',
    '<meta property="og:title" content="Original OG Title">',
    '<meta property="og:description" content="Original OG Desc">',
    '<meta property="og:url" content="https://example.com/">',
    '<meta name="twitter:title" content="Original Twitter Title">',
    '<meta name="twitter:description" content="Original Twitter Desc">',
    '</head><body></body></html>',
  ].join('\n');

  it('replaces all 7 meta tags', () => {
    const result = injectMetaTags(sampleHtml, {
      title: 'My Layout | Gridfinity Layout Tool',
      description: '10×8 layout with 5 bins',
      url: 'https://example.com/l/abc123DEF456',
    });

    expect(result).toContain('<title>My Layout | Gridfinity Layout Tool</title>');
    expect(result).toContain('name="description" content="10×8 layout with 5 bins"');
    expect(result).toContain('property="og:title" content="My Layout | Gridfinity Layout Tool"');
    expect(result).toContain('property="og:description" content="10×8 layout with 5 bins"');
    expect(result).toContain('property="og:url" content="https://example.com/l/abc123DEF456"');
    expect(result).toContain('name="twitter:title" content="My Layout | Gridfinity Layout Tool"');
    expect(result).toContain('name="twitter:description" content="10×8 layout with 5 bins"');
  });

  it('injects noindex for robots meta tag', () => {
    const result = injectMetaTags(sampleHtml, {
      title: 'Test',
      description: 'Test',
      url: 'https://example.com/l/abc123DEF456',
    });

    expect(result).toContain('name="robots" content="noindex"');
    expect(result).not.toContain('content="index, follow"');
  });

  it('escapes special characters in injected values', () => {
    const result = injectMetaTags(sampleHtml, {
      title: 'Layout <script>alert("xss")</script>',
      description: 'Desc with "quotes" & <angle brackets>',
      url: 'https://example.com/l/test',
    });

    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles string with no special chars', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});
