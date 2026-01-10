import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // in ms, 0 = no auto-dismiss
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type, duration = DEFAULT_DURATION) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = {
      id,
      message,
      type,
      duration,
      createdAt: Date.now(),
    };

    set((state) => {
      // Add new toast
      let updated = [...state.toasts, newToast];

      // If over limit, remove oldest (they'll animate out)
      if (updated.length > MAX_TOASTS) {
        updated = updated.slice(-MAX_TOASTS);
      }

      return { toasts: updated };
    });
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
