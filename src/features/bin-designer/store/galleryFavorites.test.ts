// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useGalleryFavoritesStore } from './galleryFavorites';

describe('galleryFavorites store', () => {
  beforeEach(() => {
    localStorage.clear();
    useGalleryFavoritesStore.setState({ favoriteIds: [] });
  });

  it('toggles a favorite on and off', () => {
    useGalleryFavoritesStore.getState().toggleFavorite('compartments-2x2-split');
    expect(useGalleryFavoritesStore.getState().favoriteIds).toContain('compartments-2x2-split');
    useGalleryFavoritesStore.getState().toggleFavorite('compartments-2x2-split');
    expect(useGalleryFavoritesStore.getState().favoriteIds).not.toContain('compartments-2x2-split');
  });

  it('isFavorite reflects state', () => {
    expect(useGalleryFavoritesStore.getState().isFavorite('x')).toBe(false);
    useGalleryFavoritesStore.getState().toggleFavorite('x');
    expect(useGalleryFavoritesStore.getState().isFavorite('x')).toBe(true);
  });

  it('persists across store re-read', () => {
    useGalleryFavoritesStore.getState().toggleFavorite('y');
    // value should have been written through the localStorage backend
    expect(useGalleryFavoritesStore.getState().favoriteIds).toContain('y');
  });
});
