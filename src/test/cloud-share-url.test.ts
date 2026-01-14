/**
 * Tests for cloud share URL detection utilities.
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

  it('returns share ID from /s/{id} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123xyz789',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('returns null for non-share paths', () => {
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
      pathname: '/s/abc123',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (too long)', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123xyz7890extra',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns null for invalid share ID format (non-alphanumeric)', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc-123_xyz!',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBeNull();
  });

  it('returns share ID from hash format #/s/{id}', () => {
    window.location = {
      ...originalLocation,
      pathname: '/',
      hash: '#/s/abc123xyz789',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abc123xyz789');
  });

  it('accepts lowercase alphanumeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abcdefghijkl',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('abcdefghijkl');
  });

  it('accepts uppercase alphanumeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/ABCDEFGHIJKL',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('ABCDEFGHIJKL');
  });

  it('accepts mixed case alphanumeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/AbC123XyZ789',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('AbC123XyZ789');
  });

  it('accepts all-numeric IDs', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/123456789012',
      hash: '',
    } as Location;

    expect(getCloudShareIdFromURL()).toBe('123456789012');
  });

  it('returns null for other paths starting with /s/', () => {
    window.location = {
      ...originalLocation,
      pathname: '/settings',
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

  it('replaces URL with / when on /s/{id} path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/abc123xyz789',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('does not change URL when not on /s/ path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('clears URL for any /s/ prefixed path', () => {
    window.location = {
      ...originalLocation,
      pathname: '/s/anything',
    } as Location;

    clearCloudShareFromURL();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });
});
