/**
 * Keyboard shortcuts for the bin designer preview.
 * Keys 1-4: Camera presets, R: Reset, W: Wireframe toggle.
 */

import { useEffect } from 'react';
import { SHORTCUTS } from '@/core/constants';
import type { CameraPreset } from '../components/preview';

interface UseDesignerKeyboardOptions {
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
  onToggleWireframe: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToolSwitch?: () => void;
}

const PRESET_KEYS: Record<string, CameraPreset> = {
  '1': 'front',
  '2': 'side',
  '3': 'top',
  '4': 'isometric',
};

/**
 * Register global keyboard shortcuts for designer controls.
 *
 * Supported shortcuts:
 * - Number keys 1–4: switch camera preset (front, side, top, isometric)
 * - R / r: reset the view
 * - W / w: toggle wireframe
 * - Ctrl/Cmd+Z: undo
 * - Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: redo
 *
 * @param onCameraPreset - Called with the selected camera preset when a preset key is pressed
 * @param onResetView - Called when the reset view shortcut is pressed
 * @param onToggleWireframe - Called when the wireframe toggle shortcut is pressed
 * @param onUndo - Called when the undo shortcut is pressed
 * @param onRedo - Called when the redo shortcut is pressed
 */
export function useDesignerKeyboard({
  onCameraPreset,
  onResetView,
  onToggleWireframe,
  onUndo,
  onRedo,
  onToolSwitch,
}: UseDesignerKeyboardOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Handle undo/redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          onUndo();
          return;
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
          e.preventDefault();
          onRedo();
          return;
        }
        return;
      }

      if (e.altKey) return;

      // Tool switch (Shift+D) — toggle to Grid Editor
      if (e.key === SHORTCUTS.TOOL_SWITCH && e.shiftKey && onToolSwitch) {
        e.preventDefault();
        onToolSwitch();
        return;
      }

      if (e.key in PRESET_KEYS) {
        e.preventDefault();
        onCameraPreset(PRESET_KEYS[e.key]);
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onResetView();
        return;
      }

      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        onToggleWireframe();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCameraPreset, onResetView, onToggleWireframe, onUndo, onRedo, onToolSwitch]);
}
