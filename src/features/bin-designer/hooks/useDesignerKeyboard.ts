/**
 * Keyboard shortcuts for the bin designer preview.
 * Keys 1-4: Camera presets, R: Reset, W: Wireframe toggle.
 */

import { useEffect } from 'react';
import type { CameraPreset } from '../components/preview';

interface UseDesignerKeyboardOptions {
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
  onToggleWireframe: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const PRESET_KEYS: Record<string, CameraPreset> = {
  '1': 'front',
  '2': 'side',
  '3': 'top',
  '4': 'isometric',
};

export function useDesignerKeyboard({
  onCameraPreset,
  onResetView,
  onToggleWireframe,
  onUndo,
  onRedo,
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

      const preset = PRESET_KEYS[e.key];
      if (preset) {
        e.preventDefault();
        onCameraPreset(preset);
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
  }, [onCameraPreset, onResetView, onToggleWireframe, onUndo, onRedo]);
}
