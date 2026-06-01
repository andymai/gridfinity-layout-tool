import { describe, it, expect, beforeEach } from 'vitest';
import { useBinExampleGalleryStore, INITIAL_BIN_EXAMPLE_GALLERY_STATE } from './binExampleGallery';

describe('binExampleGallery store', () => {
  beforeEach(() => {
    useBinExampleGalleryStore.setState(INITIAL_BIN_EXAMPLE_GALLERY_STATE);
  });

  it('starts closed', () => {
    expect(useBinExampleGalleryStore.getState().isOpen).toBe(false);
  });

  it('open() sets isOpen true', () => {
    useBinExampleGalleryStore.getState().open();
    expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
  });

  it('close() sets isOpen false', () => {
    useBinExampleGalleryStore.getState().open();
    useBinExampleGalleryStore.getState().close();
    expect(useBinExampleGalleryStore.getState().isOpen).toBe(false);
  });

  it('toggle() flips isOpen', () => {
    useBinExampleGalleryStore.getState().toggle();
    expect(useBinExampleGalleryStore.getState().isOpen).toBe(true);
  });
});
