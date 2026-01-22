import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCollabMode, getCollabMode } from '@/hooks/useCollabMode';
import { useLabsStore, useLibraryStore } from '@/core/store';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import type { CloudShareInfo, LayoutLibrary, LayoutEntry } from '@/core/types';

const TEST_LAYOUT_ID = 'test-layout-123';
const TEST_SHARE_ID = 'share-abc-123';

function createTestEntry(cloudShare?: CloudShareInfo): LayoutEntry {
  return {
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
  };
}

function createTestLibrary(cloudShare?: CloudShareInfo): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: TEST_LAYOUT_ID,
    settings: {},
    entries: [createTestEntry(cloudShare)],
  };
}

function createCloudShare(permission: 'view' | 'edit'): CloudShareInfo {
  return {
    id: TEST_SHARE_ID,
    deleteToken: 'delete-token',
    permission,
    sharedAt: Date.now(),
  };
}

describe('useCollabMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores to default state
    useLabsStore.setState({
      features: {},
      isFeatureEnabled: (featureId: string) => {
        return useLabsStore.getState().features[featureId]?.enabled ?? false;
      },
    });

    useLibraryStore.setState({
      library: createTestLibrary(),
      isLoaded: true,
    });

    useSharedPreviewStore.setState({
      sharedLayoutCloudShareId: null,
      sharedLayoutPermission: undefined,
      sharedLayoutPreview: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('feature flag disabled', () => {
    it('returns non-collaborative mode when feature is disabled', () => {
      useLabsStore.setState({
        features: { collaborative_editing: { enabled: false } },
        isFeatureEnabled: () => false,
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current).toEqual({
        isCollaborative: false,
        canEdit: true,
        shareId: null,
      });
    });

    it('returns non-collaborative even with cloud share when feature is disabled', () => {
      useLabsStore.setState({
        features: { collaborative_editing: { enabled: false } },
        isFeatureEnabled: () => false,
      });

      useLibraryStore.setState({
        library: createTestLibrary(createCloudShare('edit')),
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current.isCollaborative).toBe(false);
      expect(result.current.canEdit).toBe(true);
    });
  });

  describe('feature flag enabled - shared preview mode', () => {
    beforeEach(() => {
      useLabsStore.setState({
        features: { collaborative_editing: { enabled: true } },
        isFeatureEnabled: () => true,
      });
    });

    it('returns collaborative mode when viewing shared layout with edit permission', () => {
      useSharedPreviewStore.setState({
        sharedLayoutCloudShareId: TEST_SHARE_ID,
        sharedLayoutPermission: 'edit',
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current).toEqual({
        isCollaborative: true,
        canEdit: true,
        shareId: TEST_SHARE_ID,
      });
    });

    it('returns non-collaborative mode when viewing shared layout with view permission', () => {
      useSharedPreviewStore.setState({
        sharedLayoutCloudShareId: TEST_SHARE_ID,
        sharedLayoutPermission: 'view',
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current).toEqual({
        isCollaborative: false,
        canEdit: false,
        shareId: TEST_SHARE_ID,
      });
    });

    it('shared preview takes precedence over local cloud share', () => {
      // Local layout has view permission cloud share
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShare('view')),
      });

      // But shared preview has edit permission
      useSharedPreviewStore.setState({
        sharedLayoutCloudShareId: 'different-share-id',
        sharedLayoutPermission: 'edit',
      });

      const { result } = renderHook(() => useCollabMode());

      // Should use shared preview's share ID, not local
      expect(result.current.shareId).toBe('different-share-id');
      expect(result.current.isCollaborative).toBe(true);
    });
  });

  describe('feature flag enabled - local cloud share', () => {
    beforeEach(() => {
      useLabsStore.setState({
        features: { collaborative_editing: { enabled: true } },
        isFeatureEnabled: () => true,
      });
    });

    it('returns collaborative mode when local layout has edit cloud share', () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShare('edit')),
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current).toEqual({
        isCollaborative: true,
        canEdit: true,
        shareId: TEST_SHARE_ID,
      });
    });

    it('returns non-collaborative mode when local layout has view cloud share', () => {
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShare('view')),
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current).toEqual({
        isCollaborative: false,
        canEdit: false,
        shareId: TEST_SHARE_ID,
      });
    });

    it('returns non-collaborative when no cloud share exists', () => {
      useLibraryStore.setState({
        library: createTestLibrary(), // No cloud share
      });

      const { result } = renderHook(() => useCollabMode());

      expect(result.current).toEqual({
        isCollaborative: false,
        canEdit: true,
        shareId: null,
      });
    });
  });

  describe('reactivity', () => {
    beforeEach(() => {
      useLabsStore.setState({
        features: { collaborative_editing: { enabled: true } },
        isFeatureEnabled: () => true,
      });
    });

    it('updates when cloud share changes', () => {
      const { result, rerender } = renderHook(() => useCollabMode());

      // Initially no cloud share
      expect(result.current.isCollaborative).toBe(false);

      // Add cloud share
      useLibraryStore.setState({
        library: createTestLibrary(createCloudShare('edit')),
      });

      rerender();

      expect(result.current.isCollaborative).toBe(true);
    });

    it('updates when shared preview changes', () => {
      const { result, rerender } = renderHook(() => useCollabMode());

      // Initially no shared preview
      expect(result.current.isCollaborative).toBe(false);

      // Enter shared preview mode
      useSharedPreviewStore.setState({
        sharedLayoutCloudShareId: TEST_SHARE_ID,
        sharedLayoutPermission: 'edit',
      });

      rerender();

      expect(result.current.isCollaborative).toBe(true);
      expect(result.current.shareId).toBe(TEST_SHARE_ID);
    });
  });
});

describe('getCollabMode', () => {
  beforeEach(() => {
    useLabsStore.setState({
      features: {},
      isFeatureEnabled: () => false,
    });

    useLibraryStore.setState({
      library: createTestLibrary(),
      isLoaded: true,
    });

    useSharedPreviewStore.setState({
      sharedLayoutCloudShareId: null,
      sharedLayoutPermission: undefined,
    });
  });

  it('returns same result as hook for non-collaborative mode', () => {
    const result = getCollabMode();

    expect(result).toEqual({
      isCollaborative: false,
      canEdit: true,
      shareId: null,
    });
  });

  it('returns collaborative mode when feature enabled and has edit share', () => {
    useLabsStore.setState({
      features: { collaborative_editing: { enabled: true } },
      isFeatureEnabled: () => true,
    });

    useLibraryStore.setState({
      library: createTestLibrary(createCloudShare('edit')),
    });

    const result = getCollabMode();

    expect(result.isCollaborative).toBe(true);
    expect(result.canEdit).toBe(true);
    expect(result.shareId).toBe(TEST_SHARE_ID);
  });

  it('handles shared preview mode', () => {
    useLabsStore.setState({
      features: { collaborative_editing: { enabled: true } },
      isFeatureEnabled: () => true,
    });

    useSharedPreviewStore.setState({
      sharedLayoutCloudShareId: 'preview-share-id',
      sharedLayoutPermission: 'edit',
    });

    const result = getCollabMode();

    expect(result.isCollaborative).toBe(true);
    expect(result.shareId).toBe('preview-share-id');
  });

  it('returns view-only mode for view permission', () => {
    useLabsStore.setState({
      features: { collaborative_editing: { enabled: true } },
      isFeatureEnabled: () => true,
    });

    useLibraryStore.setState({
      library: createTestLibrary(createCloudShare('view')),
    });

    const result = getCollabMode();

    expect(result.isCollaborative).toBe(false);
    expect(result.canEdit).toBe(false);
    expect(result.shareId).toBe(TEST_SHARE_ID);
  });
});
