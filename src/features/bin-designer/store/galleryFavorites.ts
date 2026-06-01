import { create } from 'zustand';
import { isOk } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

const STORAGE_KEY = 'gridfinity-bin-example-favorites';

interface GalleryFavoritesState {
  favoriteIds: string[];
}

interface GalleryFavoritesActions {
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export type GalleryFavoritesStore = GalleryFavoritesState & GalleryFavoritesActions;

function loadInitial(): string[] {
  const result = loadFromLocalStorage<string[]>(STORAGE_KEY);
  if (isOk(result) && Array.isArray(result.value)) {
    return result.value;
  }
  return [];
}

export const useGalleryFavoritesStore = create<GalleryFavoritesStore>()((set, get) => ({
  favoriteIds: loadInitial(),

  toggleFavorite: (id: string): void => {
    const current = get().favoriteIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    set({ favoriteIds: next });
    saveToLocalStorage(STORAGE_KEY, next);
  },

  isFavorite: (id: string): boolean => get().favoriteIds.includes(id),
}));
