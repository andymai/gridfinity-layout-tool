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
 * - 3D Preview: isometric preview state (grouped here as a view mode)
 */

export type DropTarget = 'trash' | 'staging' | null;

export interface PaintSize {
  width: number;
  depth: number;
}

export type LayerViewMode = 'focus' | 'stack' | 'all';

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

  // 3D Preview state
  showIsometricPreview: boolean;
  isometricRotation: number; // Horizontal rotation degrees, 0-360
  layerViewMode: LayerViewMode; // 'focus' (active only), 'stack' (active+below), 'all'
  isPreviewExpanded: boolean; // Expanded modal view
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

  // 3D Preview
  toggleIsometricPreview: () => void;
  setIsometricRotation: (rotation: number) => void;
  setLayerViewMode: (mode: LayerViewMode) => void;
  snapToIsometric: () => void; // Snap to nearest 90°
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;
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
  showIsometricPreview: false,
  isometricRotation: 0,
  layerViewMode: 'stack', // Default: show active layer and below
  isPreviewExpanded: false,

  // Interaction actions
  setInteraction: (interaction) => set({ interaction }),
  setDropTarget: (target) => set({ dropTarget: target }),

  // Paint mode actions
  setPaintSize: (size) => set({ paintSize: size }),
  togglePaintSize: (size) =>
    set((state) => ({
      paintSize:
        state.paintSize?.width === size.width && state.paintSize?.depth === size.depth
          ? null
          : size,
    })),

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
    set({ liveMessage: message });
    // Clear after 1 second to allow repeat announcements of the same message
    setTimeout(() => {
      set({ liveMessage: null });
    }, 1000);
  },

  // 3D Preview actions
  toggleIsometricPreview: () =>
    set((state) => ({
      showIsometricPreview: !state.showIsometricPreview,
    })),
  setIsometricRotation: (rotation) =>
    set({
      isometricRotation: ((rotation % 360) + 360) % 360, // Normalize to 0-360
    }),
  setLayerViewMode: (mode) => set({ layerViewMode: mode }),
  snapToIsometric: () =>
    set((state) => {
      // Snap to nearest 90° angle
      const snapped = Math.round(state.isometricRotation / 90) * 90;
      return { isometricRotation: snapped % 360 };
    }),
  togglePreviewExpanded: () =>
    set((state) => ({
      isPreviewExpanded: !state.isPreviewExpanded,
    })),
  setPreviewExpanded: (expanded) => set({ isPreviewExpanded: expanded }),
}));
