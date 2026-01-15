/**
 * Tests for cloud share URL detection utilities.
 * Tests both /s/{id} (share links) and /l/{id}/{slug} (local/unified) patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCloudShareIdFromURL,
  clearCloudShareFromURL,
} from '../storage';

describe('getCloudShareIdFromURL', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete (window as { location?: Location }).location;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  // === Share URL pattern: /s/{id} ===

  it('returns share ID from /s/{id} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123xyz789',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns null for /s/{id} with trailing path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123xyz789/extra',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for /s/ without ID', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for /s/{id} with invalid ID (too short)', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  // === Unified URL pattern: /l/{id} ===

  it('returns share ID from /l/{id} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc123xyz789',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns share ID from /l/{id}/{slug} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc123xyz789/my-layout-name',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns null for root path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too short)', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc123',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too long)', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc123xyz7890extra',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (non-alphanumeric)', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc-123_xyz!',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('accepts lowercase alphanumeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abcdefghijkl',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abcdefghijkl');
  });

  it('accepts uppercase alphanumeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/ABCDEFGHIJKL',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('ABCDEFGHIJKL');
  });

  it('accepts mixed case alphanumeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/AbC123XyZ789',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('AbC123XyZ789');
  });

  it('accepts all-numeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/123456789012',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('123456789012');
  });

  it('returns null for paths not under /l/', () => {
    window.location = {
      ...originalLocation,
      pathname: '/settings',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for /l/ without ID', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/',
      hash: '',
    } as Location;

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

  // === Share URL pattern: /s/{id} ===

  it('replaces URL with / when on /s/{id} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123xyz789',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  // === Unified URL pattern: /l/{id} ===

  it('replaces URL with / when on /l/{id} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc123xyz789',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('replaces URL with / when on /l/{id}/{slug} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/l/abc123xyz789/my-layout-name',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('does not change URL when on root path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('does not change URL when not on /l/ path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/settings',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});
