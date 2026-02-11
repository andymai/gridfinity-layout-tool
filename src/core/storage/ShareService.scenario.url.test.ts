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
    window.location = originalLocation;
  });

  it('returns layout ID from /l/{id} path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc123xyz789',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns layout ID from /l/{id}/{slug} path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc123xyz789/my-layout-name',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns null for root path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too short)', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc123',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too long)', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc123xyz7890extra',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (non-alphanumeric)', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc-123_xyz!',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('accepts lowercase alphanumeric IDs', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abcdefghijkl',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBe('abcdefghijkl');
  });

  it('accepts uppercase alphanumeric IDs', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/ABCDEFGHIJKL',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBe('ABCDEFGHIJKL');
  });

  it('accepts mixed case alphanumeric IDs', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/AbC123XyZ789',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBe('AbC123XyZ789');
  });

  it('accepts all-numeric IDs', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/123456789012',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBe('123456789012');
  });

  it('returns null for paths not under /l/', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/settings',
      hash: '',
    });

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for /l/ without ID', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/',
      hash: '',
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
    window.location = originalLocation;
  });

  it('replaces URL with / when on /l/{id} path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc123xyz789',
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('replaces URL with / when on /l/{id}/{slug} path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/l/abc123xyz789/my-layout-name',
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('does not change URL when on root path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/',
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('does not change URL when not on /l/ path', () => {
    window.location = Object.assign({}, originalLocation, {
      pathname: '/settings',
    });

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});
