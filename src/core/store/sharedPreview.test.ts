import { describe, it, expect, beforeEach } from 'vitest';
import { useSharedPreviewStore, INITIAL_SHARED_PREVIEW_STATE } from './sharedPreview';
import { createTestLayout } from '@/test/testUtils';

describe('sharedPreviewStore', () => {
  beforeEach(() => {
    useSharedPreviewStore.setState(INITIAL_SHARED_PREVIEW_STATE);
  });

  it('starts with null sharedPreview', () => {
    expect(useSharedPreviewStore.getState().sharedPreview).toBeNull();
  });

  describe('setSharedLayoutPreview', () => {
    it('sets preview with layout', () => {
      const layout = createTestLayout({ name: 'Shared Layout' });
      useSharedPreviewStore.getState().setSharedLayoutPreview(layout);

      const preview = useSharedPreviewStore.getState().sharedPreview;
      expect(preview).not.toBeNull();
      expect(preview?.layout).toBe(layout);
      expect(preview?.originalName).toBe('Shared Layout');
      expect(preview?.authorName).toBeNull();
      expect(preview?.cloudShareId).toBeNull();
      expect(preview?.permission).toBeNull();
    });

    it('sets all optional fields', () => {
      const layout = createTestLayout();
      useSharedPreviewStore
        .getState()
        .setSharedLayoutPreview(layout, 'Original Name', 'Author', 'share-123', 'edit');

      const preview = useSharedPreviewStore.getState().sharedPreview;
      expect(preview?.originalName).toBe('Original Name');
      expect(preview?.authorName).toBe('Author');
      expect(preview?.cloudShareId).toBe('share-123');
      expect(preview?.permission).toBe('edit');
    });

    it('clears preview when null is passed', () => {
      const layout = createTestLayout();
      useSharedPreviewStore.getState().setSharedLayoutPreview(layout);
      expect(useSharedPreviewStore.getState().sharedPreview).not.toBeNull();

      useSharedPreviewStore.getState().setSharedLayoutPreview(null);
      expect(useSharedPreviewStore.getState().sharedPreview).toBeNull();
    });

    it('defaults originalName to layout name', () => {
      const layout = createTestLayout({ name: 'My Layout' });
      useSharedPreviewStore.getState().setSharedLayoutPreview(layout);
      expect(useSharedPreviewStore.getState().sharedPreview?.originalName).toBe('My Layout');
    });
  });

  describe('clearSharedLayoutPreview', () => {
    it('clears the preview', () => {
      useSharedPreviewStore.getState().setSharedLayoutPreview(createTestLayout());
      useSharedPreviewStore.getState().clearSharedLayoutPreview();
      expect(useSharedPreviewStore.getState().sharedPreview).toBeNull();
    });
  });
});
