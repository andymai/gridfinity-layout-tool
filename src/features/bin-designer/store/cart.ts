/**
 * Export cart store for batch STL export.
 *
 * Persists a lightweight queue of design snapshots in localStorage.
 * Each CartItem contains the full BinParams needed to generate STL
 * independently of the current designer state.
 */

import { create } from 'zustand';
import type { CartItem, CartState } from '../types';

const STORAGE_KEY = 'gridfinity-designer-cart';
const MAX_CART_ITEMS = 50;

/**
 * Load the persisted cart items from localStorage.
 *
 * @returns The array of `CartItem` objects stored under the cart key; an empty array if no data exists, the stored value is not an array, or parsing/reading fails.
 */
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return items as CartItem[];
  } catch {
    return [];
  }
}

/**
 * Persists the provided cart items to the module's browser storage.
 *
 * Stores the given array in localStorage under the module storage key; if storage is unavailable or the write fails (e.g., quota exceeded), the function silently does nothing.
 *
 * @param items - Array of CartItem objects to persist
 */
function saveCart(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export const useCartStore = create<CartState>()((set) => ({
  items: loadCart(),

  addToCart: (item) =>
    set((state) => {
      // Don't add duplicates (same design ID)
      if (state.items.some((i) => i.id === item.id)) return state;
      // Enforce max
      if (state.items.length >= MAX_CART_ITEMS) return state;

      const newItem: CartItem = { ...item, addedAt: new Date().toISOString() };
      const items = [...state.items, newItem];
      saveCart(items);
      return { items };
    }),

  removeFromCart: (id) =>
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      saveCart(items);
      return { items };
    }),

  clearCart: () =>
    set(() => {
      saveCart([]);
      return { items: [] };
    }),
}));

export { MAX_CART_ITEMS };
