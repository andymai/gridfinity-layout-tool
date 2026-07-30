// @vitest-environment jsdom
/**
 * Tests for cloud share URL detection utilities.
 * Tests /l/{id}/{slug} patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCloudShareIdFromURL, clearCloudShareFromURL } from '@/core/storage';

describe('getCloudShareIdFromURL', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete (window as { location?: Location }).location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('returns layout ID from /l/{id} path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc123xyz789',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns layout ID from /l/{id}/{slug} path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc123xyz789/my-layout-name',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns null for root path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too short)', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc123',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too long)', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc123xyz7890extra',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (non-alphanumeric)', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc-123_xyz!',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('accepts lowercase alphanumeric IDs', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abcdefghijkl',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('abcdefghijkl');
  });

  it('accepts uppercase alphanumeric IDs', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/ABCDEFGHIJKL',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('ABCDEFGHIJKL');
  });

  it('accepts mixed case alphanumeric IDs', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/AbC123XyZ789',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('AbC123XyZ789');
  });

  it('accepts all-numeric IDs', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/123456789012',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('123456789012');
  });

  it('returns null for paths not under /l/', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/settings',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for /l/ without ID', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('accepts a legacy UUID share ID', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/550e8400-e29b-41d4-a716-446655440000',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts a legacy UUID share ID with a slug', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/550e8400-e29b-41d4-a716-446655440000/my-layout',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns null for a non-v4 UUID-shaped string', () => {
    // Not a v4 UUID (version nibble is 5, not 4) — isLegacyUUID rejects it.
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/550e8400-e29b-51d4-a716-446655440000',
        hash: '',
      }),
      writable: true,
      configurable: true,
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });
});

describe('clearCloudShareFromURL', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as { location?: Location }).location;
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('replaces URL with / when on /l/{id} path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc123xyz789',
      }),
      writable: true,
      configurable: true,
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('replaces URL with / when on /l/{id}/{slug} path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/abc123xyz789/my-layout-name',
      }),
      writable: true,
      configurable: true,
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('does not change URL when on root path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/',
      }),
      writable: true,
      configurable: true,
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('does not change URL when not on /l/ path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/settings',
      }),
      writable: true,
      configurable: true,
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('clears URL when on /l/{uuid}/{slug} path', () => {
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        pathname: '/l/550e8400-e29b-41d4-a716-446655440000/my-layout',
      }),
      writable: true,
      configurable: true,
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });
});
