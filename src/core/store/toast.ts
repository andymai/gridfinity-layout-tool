import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // in ms, 0 = no auto-dismiss
  createdAt: number;
  action?: ToastAction;
}

interface AddToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  /**
   * Add a toast notification.
   * @param options - Toast options object OR legacy (message, type, duration) args
   */
  addToast: ((options: AddToastOptions) => void) &
    ((message: string, type: ToastType, duration?: number) => void);
  removeToast: (id: string) => void;
}

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 3;

export const INITIAL_TOAST_STATE = {
  toasts: [] as Toast[],
} as const;

export const useToastStore = create<ToastState>((set) => ({
  ...INITIAL_TOAST_STATE,

  addToast: (
    messageOrOptions: string | AddToastOptions,
    type?: ToastType,
    duration: number = DEFAULT_DURATION
  ) => {
    // Support both new object API and legacy positional args
    const options: AddToastOptions =
      typeof messageOrOptions === 'string'
        ? { message: messageOrOptions, type: type ?? 'info', duration }
        : messageOrOptions;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = {
      id,
      message: options.message,
      type: options.type,
      duration: options.duration ?? DEFAULT_DURATION,
      createdAt: Date.now(),
      action: options.action,
    };

    set((state) => {
      let updated = [...state.toasts, newToast];

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
