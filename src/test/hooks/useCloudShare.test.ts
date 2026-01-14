import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCloudShare } from '../../hooks/useCloudShare';
import { useLibraryStore } from '../../store/library';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout } from '../../constants';
import * as shareApi from '../../api/share';
import * as storage from '../../storage';
import type { LayoutLibrary, CloudShareInfo } from '../../types';
import { ok, err, apiRateLimited, apiNotFound } from '../../result';

// Mock the share API module
vi.mock('../../api/share', () => ({
  createShare: vi.fn(),
  updateShare: vi.fn(),
  deleteShare: vi.fn(),
  getErrorMessage: vi.fn((error) => error.error || 'Unknown error'),
  // Result-based API functions
  createShareResult: vi.fn(),
  updateShareResult: vi.fn(),
  deleteShareResult: vi.fn(),
  fetchShareResult: vi.fn(),
  reportShareResult: vi.fn(),
}));

// Mock clipboard
vi.mock('../../storage', async () => {
  const actual = await vi.importActual('../../storage');
  return {
    ...actual,
    copyToClipboard: vi.fn().mockResolvedValue(true),
  };
});

const TEST_LAYOUT_ID = 'test-layout-id';

function createTestLibrary(cloudShare?: CloudShareInfo): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: TEST_LAYOUT_ID,
    settings: {},
    entries: [{
      id: TEST_LAYOUT_ID,
      name: 'Test Layout',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      },
      cloudShare,
    }],
  };
}

describe('useCloudShare', () => {
  const mockAnnounce = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    // Reset stores
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: TEST_LAYOUT_ID,
    });

    useLibraryStore.setState({
      library: createTestLibrary(),
      isLoaded: true,
      showLayoutManager: false,
    });

    useUIStore.setState({
      announceToScreenReader: mockAnnounce,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with idle status', () => {
      const { result } = renderHook(() => useCloudShare());

      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('returns existing share info from library', () => {
      const existingShare: CloudShareInfo = {
        id: 'share123',
        deleteToken: 'token456',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000, // Future
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      const { result } = renderHook(() => useCloudShare());

      expect(result.current.existingShare).toEqual(existingShare);
      expect(result.current.hasActiveShare).toBe(true);
    });

    it('reports no active share when expired', () => {
      const expiredShare: CloudShareInfo = {
        id: 'share123',
        deleteToken: 'token456',
        sharedAt: Date.now() - 86400000,
        expiresAt: Date.now() - 1000, // Past
      };

      useLibraryStore.setState({
        library: createTestLibrary(expiredShare),
      });

      const { result } = renderHook(() => useCloudShare());

      expect(result.current.hasActiveShare).toBe(false);
    });
  });

  describe('share', () => {
    it('creates share successfully', async () => {
      const mockData = {
        id: 'new-share-id',
        url: 'https://example.com/s/new-share-id',
        deleteToken: 'new-delete-token',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      };

      vi.mocked(shareApi.createShareResult).mockResolvedValue(ok(mockData));

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.share(30);
      });

      expect(success).toBe(true);
      expect(result.current.status).toBe('success');
      expect(result.current.result).not.toBeNull();
      expect(result.current.result?.id).toBe('new-share-id');
      expect(result.current.result?.url).toBe('https://example.com/s/new-share-id');
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('successfully')
      );
      expect(storage.copyToClipboard).toHaveBeenCalledWith(
        'https://example.com/s/new-share-id'
      );
    });

    it('handles share failure', async () => {
      vi.mocked(shareApi.createShareResult).mockResolvedValue(
        err(apiRateLimited(60))
      );

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.share(30);
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe('error');
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.code).toBe('API_RATE_LIMITED');
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('failed')
      );
    });

    it('handles offline state', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.share(30);
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe('error');
      expect(result.current.error?.code).toBe('NETWORK_ERROR');
      expect(result.current.error?.message).toContain('offline');
    });

    it('updates status to sharing during request', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(shareApi.createShareResult).mockReturnValue(pendingPromise as ReturnType<typeof shareApi.createShareResult>);

      const { result } = renderHook(() => useCloudShare());

      act(() => {
        result.current.share(30);
      });

      expect(result.current.status).toBe('sharing');

      // Resolve to prevent hanging
      resolvePromise!(ok({
        id: 'id',
        url: 'url',
        deleteToken: 'token',
        expiresAt: new Date().toISOString(),
      }));

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });
    });
  });

  describe('update', () => {
    it('updates existing share successfully', async () => {
      const existingShare: CloudShareInfo = {
        id: 'existing-id',
        deleteToken: 'existing-token',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      const mockData = {
        id: 'existing-id',
        url: 'https://example.com/s/existing-id',
        expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(),
      };

      vi.mocked(shareApi.updateShareResult).mockResolvedValue(ok(mockData));

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.update(60);
      });

      expect(success).toBe(true);
      expect(result.current.status).toBe('success');
      expect(shareApi.updateShareResult).toHaveBeenCalledWith(
        'existing-id',
        'existing-token',
        expect.anything(),
        60
      );
    });

    it('fails when no existing share', async () => {
      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.update(60);
      });

      expect(success).toBe(false);
      expect(result.current.error?.code).toBe('NOT_FOUND');
    });

    it('clears local share when NOT_FOUND on server', async () => {
      const existingShare: CloudShareInfo = {
        id: 'deleted-on-server',
        deleteToken: 'token',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      vi.mocked(shareApi.updateShareResult).mockResolvedValue(
        err(apiNotFound('deleted-on-server'))
      );

      const clearCloudShareSpy = vi.fn();
      useLibraryStore.setState({ clearCloudShare: clearCloudShareSpy });

      const { result } = renderHook(() => useCloudShare());

      await act(async () => {
        await result.current.update(60);
      });

      expect(clearCloudShareSpy).toHaveBeenCalledWith(TEST_LAYOUT_ID);
    });
  });

  describe('remove', () => {
    it('deletes share successfully', async () => {
      const existingShare: CloudShareInfo = {
        id: 'to-delete',
        deleteToken: 'delete-token',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      vi.mocked(shareApi.deleteShareResult).mockResolvedValue(
        ok({ success: true as const, message: 'Deleted' })
      );

      const clearCloudShareSpy = vi.fn();
      useLibraryStore.setState({ clearCloudShare: clearCloudShareSpy });

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.remove();
      });

      expect(success).toBe(true);
      expect(result.current.status).toBe('idle');
      expect(clearCloudShareSpy).toHaveBeenCalledWith(TEST_LAYOUT_ID);
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('deleted')
      );
    });

    it('returns false when no existing share', async () => {
      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.remove();
      });

      expect(success).toBe(false);
    });

    it('clears local state even when NOT_FOUND (already deleted)', async () => {
      const existingShare: CloudShareInfo = {
        id: 'already-deleted',
        deleteToken: 'token',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      vi.mocked(shareApi.deleteShareResult).mockResolvedValue(
        err(apiNotFound('already-deleted'))
      );

      const clearCloudShareSpy = vi.fn();
      useLibraryStore.setState({ clearCloudShare: clearCloudShareSpy });

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.remove();
      });

      // Should still succeed (already deleted is fine)
      expect(success).toBe(true);
      expect(clearCloudShareSpy).toHaveBeenCalled();
    });
  });

  describe('copyUrl', () => {
    it('copies URL from result', async () => {
      const mockData = {
        id: 'share-id',
        url: 'https://example.com/s/share-id',
        deleteToken: 'token',
        expiresAt: new Date().toISOString(),
      };

      vi.mocked(shareApi.createShareResult).mockResolvedValue(ok(mockData));

      const { result } = renderHook(() => useCloudShare());

      await act(async () => {
        await result.current.share(30);
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.copyUrl();
      });

      expect(success).toBe(true);
      expect(storage.copyToClipboard).toHaveBeenCalledWith(
        'https://example.com/s/share-id'
      );
    });

    it('copies URL from existing share when no result', async () => {
      const existingShare: CloudShareInfo = {
        id: 'existing-share',
        deleteToken: 'token',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com' },
        writable: true,
      });

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.copyUrl();
      });

      expect(success).toBe(true);
      expect(storage.copyToClipboard).toHaveBeenCalledWith(
        'https://example.com/s/existing-share'
      );
    });

    it('returns false when no URL available', async () => {
      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.copyUrl();
      });

      expect(success).toBe(false);
    });
  });

  describe('copyDeleteToken', () => {
    it('copies delete token', async () => {
      const existingShare: CloudShareInfo = {
        id: 'share-id',
        deleteToken: 'secret-token-123',
        sharedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      useLibraryStore.setState({
        library: createTestLibrary(existingShare),
      });

      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.copyDeleteToken();
      });

      expect(success).toBe(true);
      expect(storage.copyToClipboard).toHaveBeenCalledWith('secret-token-123');
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('token copied')
      );
    });

    it('returns false when no token available', async () => {
      const { result } = renderHook(() => useCloudShare());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.copyDeleteToken();
      });

      expect(success).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets state to idle', async () => {
      const { apiNetworkError } = await import('../../result');
      vi.mocked(shareApi.createShareResult).mockResolvedValue(
        err(apiNetworkError())
      );

      const { result } = renderHook(() => useCloudShare());

      await act(async () => {
        await result.current.share(30);
      });

      expect(result.current.status).toBe('error');

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('unmount safety', () => {
    it('does not update state after unmount', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(shareApi.createShareResult).mockReturnValue(pendingPromise as ReturnType<typeof shareApi.createShareResult>);

      const { result, unmount } = renderHook(() => useCloudShare());

      act(() => {
        result.current.share(30);
      });

      // Unmount before promise resolves
      unmount();

      // Resolve after unmount
      resolvePromise!(ok({
        id: 'id',
        url: 'url',
        deleteToken: 'token',
        expiresAt: new Date().toISOString(),
      }));

      // Should not throw or cause issues
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });

  describe('layout-specific sharing', () => {
    it('accepts optional layoutId parameter', () => {
      const { result } = renderHook(() => useCloudShare('custom-layout-id'));

      // Hook should work with custom layout ID
      expect(result.current.status).toBe('idle');
    });
  });
});
