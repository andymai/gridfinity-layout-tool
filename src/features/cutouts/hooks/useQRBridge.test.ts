/**
 * Tests for the QR Bridge hook.
 *
 * SECURITY: These tests verify the session secret is properly included
 * in Authorization headers for polling and cleanup operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQRBridge } from './useQRBridge';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test session data with 128-bit IDs
const TEST_SESSION_ID = 'a1b2c3d4e5f6789012345678abcdef01';
const TEST_SESSION_SECRET = 'fedcba9876543210fedcba9876543210';

describe('useQRBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with idle status', () => {
    const { result } = renderHook(() => useQRBridge());

    expect(result.current.status).toBe('idle');
    expect(result.current.sessionId).toBeNull();
    expect(result.current.uploadUrl).toBeNull();
    expect(result.current.isCreating).toBe(false);
    expect(result.current.isPolling).toBe(false);
  });

  it('creates a session and enters pending state', async () => {
    const sessionResponse = {
      sessionId: TEST_SESSION_ID,
      sessionSecret: TEST_SESSION_SECRET,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: `/api/cutout-session/${TEST_SESSION_ID}`,
    };

    // Create session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionResponse),
    });

    // Initial poll - pending status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    });

    const { result } = renderHook(() => useQRBridge());

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.sessionId).toBe(TEST_SESSION_ID);
    expect(result.current.uploadUrl).toContain(TEST_SESSION_ID);
    expect(result.current.isPolling).toBe(true);
  });

  it('includes session secret in Authorization header when polling', async () => {
    const sessionResponse = {
      sessionId: TEST_SESSION_ID,
      sessionSecret: TEST_SESSION_SECRET,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: `/api/cutout-session/${TEST_SESSION_ID}`,
    };

    // Create session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionResponse),
    });

    // Initial poll
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    });

    const { result } = renderHook(() => useQRBridge());

    await act(async () => {
      await result.current.startSession();
    });

    // Verify poll request includes Authorization header
    const pollCall = mockFetch.mock.calls[1];
    expect(pollCall[1]?.headers?.Authorization).toBe(`Bearer ${TEST_SESSION_SECRET}`);
  });

  it('handles session creation error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    });

    const { result } = renderHook(() => useQRBridge());

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Rate limited');
    expect(result.current.isPolling).toBe(false);
  });

  it('transitions to ready when image is uploaded', async () => {
    const sessionResponse = {
      sessionId: TEST_SESSION_ID,
      sessionSecret: TEST_SESSION_SECRET,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: `/api/cutout-session/${TEST_SESSION_ID}`,
    };

    // First call: create session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionResponse),
    });

    // Second call: initial poll returns ready
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'ready',
          imageUrl: 'https://blob.example.com/image.jpg',
          imageName: 'tool.jpg',
        }),
    });

    const { result } = renderHook(() => useQRBridge());

    await act(async () => {
      await result.current.startSession();
    });

    // The initial poll runs immediately after session creation
    expect(result.current.status).toBe('ready');
    expect(result.current.imageUrl).toBe('https://blob.example.com/image.jpg');
    expect(result.current.imageName).toBe('tool.jpg');
    expect(result.current.isPolling).toBe(false);
  });

  it('cancels session with authenticated DELETE', async () => {
    const sessionResponse = {
      sessionId: TEST_SESSION_ID,
      sessionSecret: TEST_SESSION_SECRET,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: `/api/cutout-session/${TEST_SESSION_ID}`,
    };

    // Create session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionResponse),
    });

    // Initial poll - pending
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    });

    // For the DELETE request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useQRBridge());

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.status).toBe('pending');

    await act(async () => {
      await result.current.cancelSession(true);
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.sessionId).toBeNull();
    expect(result.current.isPolling).toBe(false);

    // Verify DELETE request includes Authorization header
    const deleteCall = mockFetch.mock.calls[2];
    expect(deleteCall[1]?.method).toBe('DELETE');
    expect(deleteCall[1]?.headers?.Authorization).toBe(`Bearer ${TEST_SESSION_SECRET}`);
  });

  it('resets state without cleanup', async () => {
    const sessionResponse = {
      sessionId: TEST_SESSION_ID,
      sessionSecret: TEST_SESSION_SECRET,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: `/api/cutout-session/${TEST_SESSION_ID}`,
    };

    // Create session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionResponse),
    });

    // Initial poll - pending
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    });

    const { result } = renderHook(() => useQRBridge());

    await act(async () => {
      await result.current.startSession();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.sessionId).toBeNull();
    // Should have called create + initial poll, but NOT DELETE
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
