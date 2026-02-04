/**
 * Tests for the QR Bridge hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQRBridge } from './useQRBridge';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
      sessionId: 'test1234567890ab',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: '/api/cutout-session/test1234567890ab',
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
    expect(result.current.sessionId).toBe('test1234567890ab');
    expect(result.current.uploadUrl).toContain('test1234567890ab');
    expect(result.current.isPolling).toBe(true);
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
      sessionId: 'test1234567890ab',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: '/api/cutout-session/test1234567890ab',
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

  it('cancels session and cleans up', async () => {
    const sessionResponse = {
      sessionId: 'test1234567890ab',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: '/api/cutout-session/test1234567890ab',
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
  });

  it('resets state without cleanup', async () => {
    const sessionResponse = {
      sessionId: 'test1234567890ab',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      uploadUrl: '/api/cutout-session/test1234567890ab',
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
