import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  pollCollection,
  isPollNotModified,
  sendHeartbeat,
} from '../../api/collection';
import type { PollResponse, HeartbeatResponse, CollectionErrorResponse } from '../../api/collection';

describe('Collection Sync API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('pollCollection', () => {
    it('should return poll data on success', async () => {
      const mockResponse: PollResponse = {
        modifiedAt: Date.now(),
        layouts: [
          { id: 'layout1', modifiedAt: Date.now(), activeEditors: 2 },
          { id: 'layout2', modifiedAt: Date.now(), activeEditors: 0 },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await pollCollection('abc123def456');

      expect(result).toEqual({ success: true, data: mockResponse });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/poll',
        expect.objectContaining({ headers: {} })
      );
    });

    it('should include If-Modified-Since header when lastModifiedAt provided', async () => {
      const mockResponse: PollResponse = {
        modifiedAt: Date.now(),
        layouts: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const timestamp = 1700000000000;
      await pollCollection('abc123def456', timestamp);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/poll',
        expect.objectContaining({
          headers: { 'If-Modified-Since': '1700000000000' },
        })
      );
    });

    it('should return notModified when 304 status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 304,
      });

      const result = await pollCollection('abc123def456', Date.now());

      expect(result).toEqual({ notModified: true });
    });

    it('should return error on failure', async () => {
      const errorResponse: CollectionErrorResponse = {
        error: 'Collection not found',
        code: 'NOT_FOUND',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse),
      });

      const result = await pollCollection('abc123def456');

      expect(result).toEqual({ success: false, error: errorResponse });
    });

    it('should return network error on fetch failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await pollCollection('abc123def456');

      expect(result).toEqual({
        success: false,
        error: {
          error: 'Network error. Check your connection.',
          code: 'NETWORK_ERROR',
        },
      });
    });
  });

  describe('isPollNotModified', () => {
    it('should return true for notModified result', () => {
      expect(isPollNotModified({ notModified: true })).toBe(true);
    });

    it('should return false for success result', () => {
      const result = {
        success: true as const,
        data: { modifiedAt: Date.now(), layouts: [] },
      };
      expect(isPollNotModified(result)).toBe(false);
    });

    it('should return false for error result', () => {
      const result = {
        success: false as const,
        error: { error: 'Error', code: 'NOT_FOUND' as const },
      };
      expect(isPollNotModified(result)).toBe(false);
    });
  });

  describe('sendHeartbeat', () => {
    it('should send heartbeat and return response', async () => {
      const mockResponse: HeartbeatResponse = {
        acknowledged: true,
        activeEditors: 3,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await sendHeartbeat(
        'abc123def456',
        '550e8400-e29b-41d4-a716-446655440000',
        'device-123'
      );

      expect(result).toEqual({ success: true, data: mockResponse });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/heartbeat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layoutId: '550e8400-e29b-41d4-a716-446655440000',
            deviceId: 'device-123',
          }),
        }
      );
    });

    it('should return error on rate limit', async () => {
      const errorResponse: CollectionErrorResponse = {
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 60,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve(errorResponse),
      });

      const result = await sendHeartbeat('abc123def456', 'layout1', 'device1');

      expect(result).toEqual({ success: false, error: errorResponse });
    });

    it('should return network error on fetch failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await sendHeartbeat('abc123def456', 'layout1', 'device1');

      expect(result).toEqual({
        success: false,
        error: {
          error: 'Network error.',
          code: 'NETWORK_ERROR',
        },
      });
    });
  });
});
