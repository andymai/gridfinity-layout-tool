import { create } from 'zustand';
import type { Interaction } from '@/core/types';

/**
 * Interaction Store
 *
 * Manages active interactions, modes, and transient state during user operations.
 * Extracted from ui.ts as part of the god object decomposition.
 *
 * State groups:
 * - Interaction: current drag/draw/resize/paint operation
 * - Drop target: where items will be dropped during drag
 * - Paint mode: fill mode brush size
 * - Keyboard modes: keyboard-driven drag/resize
 * - Accessibility: screen reader live region messages
 */

export type DropTarget = 'staging' | null;

// Module-level timeout ID for screen reader announcements
let liveMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;

export interface PaintSize {
  width: number;
  depth: number;
}

interface InteractionState {
  // Active interaction
  interaction: Interaction | null;
  dropTarget: DropTarget;

  // Paint mode
  paintSize: PaintSize | null;

  // Keyboard modes
  keyboardDragMode: boolean;
  keyboardResizeMode: boolean;

  // Accessibility (screen reader announcements)
  liveMessage: string | null;
}

interface InteractionActions {
  // Interaction
  setInteraction: (interaction: Interaction | null) => void;
  setDropTarget: (target: DropTarget) => void;

  // Paint mode
  setPaintSize: (size: PaintSize | null) => void;
  togglePaintSize: (size: PaintSize) => void;

  // Keyboard modes
  setKeyboardDragMode: (enabled: boolean) => void;
  setKeyboardResizeMode: (enabled: boolean) => void;

  // Accessibility
  announceToScreenReader: (message: string) => void;
}

export type InteractionStore = InteractionState & InteractionActions;

export const useInteractionStore = create<InteractionStore>((set) => ({
  // Initial state
  interaction: null,
  dropTarget: null,
  paintSize: null,
  keyboardDragMode: false,
  keyboardResizeMode: false,
  liveMessage: null,

  // Interaction actions
  setInteraction: (interaction) => set({ interaction }),
  setDropTarget: (target) => set({ dropTarget: target }),

  // Paint mode actions
  setPaintSize: (size) => set({ paintSize: size }),
  togglePaintSize: (size) => {
    set((state) => ({
      paintSize:
        state.paintSize?.width === size.width && state.paintSize.depth === size.depth ? null : size,
    }));
  },

  // Keyboard mode actions
  setKeyboardDragMode: (enabled) =>
    set({
      keyboardDragMode: enabled,
      // Exit resize mode when entering drag mode
      ...(enabled ? { keyboardResizeMode: false } : {}),
    }),
  setKeyboardResizeMode: (enabled) =>
    set({
      keyboardResizeMode: enabled,
      // Exit drag mode when entering resize mode
      ...(enabled ? { keyboardDragMode: false } : {}),
    }),

  // Accessibility actions
  announceToScreenReader: (message) => {
    // Clear existing timeout to prevent queued timeouts from accumulating
    if (liveMessageTimeoutId) {
      clearTimeout(liveMessageTimeoutId);
    }
    set({ liveMessage: message });
    // Clear after 1 second to allow repeat announcements of the same message
    liveMessageTimeoutId = setTimeout(() => {
      set({ liveMessage: null });
      liveMessageTimeoutId = null;
    }, 1000);
  },
}));
