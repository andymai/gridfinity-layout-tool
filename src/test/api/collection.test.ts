/**
 * Tests for collection API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createCollection,
  fetchCollection,
  updateCollection,
  deleteCollection,
  addLayout,
  fetchLayout,
  updateLayout,
  deleteLayout,
  getCollectionErrorMessage,
} from '../../api/collection';
import type { Layout } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test fixtures
const mockLayout: Layout = {
  name: 'Test Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  bins: [],
  layers: [{ id: 'layer-1', name: 'Base', height: 3 }],
  categories: [{ id: 'cat-1', name: 'Default', color: '#3b82f6' }],
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
};

const mockCollectionResponse = {
  id: 'abc123def456',
  name: 'My Collection',
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  layoutCount: 1,
  layouts: [
    {
      id: 'layout-uuid-1',
      name: 'Test Layout',
      modifiedAt: Date.now(),
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      },
    },
  ],
  url: 'http://localhost:3000/c/abc123def456',
  viewOnlyUrl: 'http://localhost:3000/c/abc123def456/view',
};

describe('Collection API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCollection', () => {
    it('should create a collection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCollectionResponse),
      });

      const result = await createCollection('My Collection', mockLayout);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('abc123def456');
        expect(result.data.name).toBe('My Collection');
        expect(result.data.layouts).toHaveLength(1);
      }

      expect(mockFetch).toHaveBeenCalledWith('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Collection', initialLayout: mockLayout }),
      });
    });

    it('should create a collection without initial layout', async () => {
      const responseWithoutLayout = { ...mockCollectionResponse, layoutCount: 0, layouts: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithoutLayout),
      });

      const result = await createCollection('Empty Collection');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.layouts).toHaveLength(0);
      }

      expect(mockFetch).toHaveBeenCalledWith('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Empty Collection' }),
      });
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'Too many collections created',
            code: 'RATE_LIMITED',
            retryAfter: 3600,
          }),
      });

      const result = await createCollection('Test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMITED');
        expect(result.error.retryAfter).toBe(3600);
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await createCollection('Test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('fetchCollection', () => {
    it('should fetch a collection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCollectionResponse),
      });

      const result = await fetchCollection('abc123def456');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('abc123def456');
        expect(result.data.layouts).toHaveLength(1);
      }

      expect(mockFetch).toHaveBeenCalledWith('/api/collection/abc123def456');
    });

    it('should handle not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'Collection not found',
            code: 'NOT_FOUND',
          }),
      });

      const result = await fetchCollection('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should handle expired collection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'Collection has expired',
            code: 'COLLECTION_EXPIRED',
          }),
      });

      const result = await fetchCollection('expired123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('COLLECTION_EXPIRED');
      }
    });
  });

  describe('updateCollection', () => {
    it('should update collection name successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'abc123def456',
            name: 'New Name',
            modifiedAt: Date.now(),
            expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          }),
      });

      const result = await updateCollection('abc123def456', 'New Name');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('New Name');
      }

      expect(mockFetch).toHaveBeenCalledWith('/api/collection/abc123def456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Collection deleted successfully',
          }),
      });

      const result = await deleteCollection('abc123def456');

      expect(result.success).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith('/api/collection/abc123def456', {
        method: 'DELETE',
      });
    });
  });

  describe('addLayout', () => {
    it('should add layout to collection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'new-layout-uuid',
            name: 'Test Layout',
            modifiedAt: Date.now(),
            preview: {
              drawerWidth: 10,
              drawerDepth: 8,
              drawerHeight: 12,
              binCount: 0,
              layerCount: 1,
            },
          }),
      });

      const result = await addLayout('abc123def456', mockLayout);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('new-layout-uuid');
        expect(result.data.name).toBe('Test Layout');
      }

      expect(mockFetch).toHaveBeenCalledWith('/api/collection/abc123def456/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: mockLayout }),
      });
    });

    it('should handle collection full error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'Collection has reached maximum layouts',
            code: 'COLLECTION_FULL',
          }),
      });

      const result = await addLayout('abc123def456', mockLayout);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('COLLECTION_FULL');
      }
    });
  });

  describe('fetchLayout', () => {
    it('should fetch layout successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            layout: mockLayout,
            modifiedAt: Date.now(),
          }),
      });

      const result = await fetchLayout('abc123def456', 'layout-uuid-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.layout.name).toBe('Test Layout');
      }

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/layout/layout-uuid-1'
      );
    });
  });

  describe('updateLayout', () => {
    it('should update layout successfully', async () => {
      const serverModifiedAt = Date.now();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            modifiedAt: serverModifiedAt,
          }),
      });

      const result = await updateLayout('abc123def456', 'layout-uuid-1', mockLayout);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.modifiedAt).toBe(serverModifiedAt);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/layout/layout-uuid-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: mockLayout }),
        }
      );
    });

    it('should include expectedModifiedAt for conflict detection', async () => {
      const expectedModifiedAt = Date.now() - 1000;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ modifiedAt: Date.now() }),
      });

      await updateLayout('abc123def456', 'layout-uuid-1', mockLayout, {
        expectedModifiedAt,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/layout/layout-uuid-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: mockLayout, expectedModifiedAt }),
        }
      );
    });

    it('should include name for rename', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ modifiedAt: Date.now() }),
      });

      await updateLayout('abc123def456', 'layout-uuid-1', mockLayout, {
        name: 'Renamed Layout',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/layout/layout-uuid-1',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: mockLayout, name: 'Renamed Layout' }),
        }
      );
    });

    it('should handle conflict error with server data', async () => {
      const serverLayout = { ...mockLayout, name: 'Server Version' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            code: 'CONFLICT',
            serverModifiedAt: Date.now(),
            serverLayout,
          }),
      });

      const result = await updateLayout('abc123def456', 'layout-uuid-1', mockLayout, {
        expectedModifiedAt: Date.now() - 5000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.serverModifiedAt).toBeDefined();
        expect(result.error.serverLayout).toEqual(serverLayout);
      }
    });
  });

  describe('deleteLayout', () => {
    it('should delete layout successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Layout deleted successfully',
          }),
      });

      const result = await deleteLayout('abc123def456', 'layout-uuid-1');

      expect(result.success).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/collection/abc123def456/layout/layout-uuid-1',
        { method: 'DELETE' }
      );
    });
  });

  describe('getCollectionErrorMessage', () => {
    it('should return user-friendly message for NOT_FOUND', () => {
      const message = getCollectionErrorMessage({
        error: 'Not found',
        code: 'NOT_FOUND',
      });
      expect(message).toBe('Collection not found.');
    });

    it('should return user-friendly message for COLLECTION_EXPIRED', () => {
      const message = getCollectionErrorMessage({
        error: 'Expired',
        code: 'COLLECTION_EXPIRED',
      });
      expect(message).toBe('Collection has expired due to inactivity.');
    });

    it('should return user-friendly message for CONFLICT', () => {
      const message = getCollectionErrorMessage({
        error: 'Conflict',
        code: 'CONFLICT',
      });
      expect(message).toBe('Someone else modified this layout. Please review the changes.');
    });

    it('should return user-friendly message for RATE_LIMITED with retry', () => {
      const message = getCollectionErrorMessage({
        error: 'Rate limited',
        code: 'RATE_LIMITED',
        retryAfter: 120,
      });
      expect(message).toBe('Too many requests. Try again in 2 minutes.');
    });

    it('should return user-friendly message for COLLECTION_FULL', () => {
      const message = getCollectionErrorMessage({
        error: 'Full',
        code: 'COLLECTION_FULL',
      });
      expect(message).toBe('Collection has reached the maximum of 50 layouts.');
    });

    it('should return user-friendly message for NETWORK_ERROR', () => {
      const message = getCollectionErrorMessage({
        error: 'Network error',
        code: 'NETWORK_ERROR',
      });
      expect(message).toBe('Connection failed. Check your internet connection.');
    });

    it('should return original error for unknown code', () => {
      const message = getCollectionErrorMessage({
        error: 'Custom error message',
        code: 'UNKNOWN_CODE' as 'NOT_FOUND',
      });
      expect(message).toBe('Custom error message');
    });
  });
});
