import { useEffect } from 'react';
import type { SceneHandle } from '../components/Grid/IsometricPreview/Scene';

interface Use3DPreviewKeyboardProps {
  sceneRef: React.RefObject<SceneHandle | null>;
  isPreviewVisible: boolean;
  isPreviewExpanded: boolean;
  togglePreviewVisibility: () => void;
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;
}

/**
 * Keyboard shortcuts for 3D preview navigation and control.
 * Provides intuitive keyboard navigation for power users.
 */
export function use3DPreviewKeyboard({
  sceneRef,
  isPreviewVisible,
  isPreviewExpanded,
  togglePreviewVisibility,
  togglePreviewExpanded,
  setPreviewExpanded,
}: Use3DPreviewKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't handle if preview is not visible (except for 'v' to toggle visibility)
      if (!isPreviewVisible && e.key !== 'v') {
        return;
      }

      switch (e.key) {
        case 'v':
          // Toggle preview visibility
          e.preventDefault();
          togglePreviewVisibility();
          break;

        case ' ':
          // Toggle expand/collapse (only if preview is visible)
          if (isPreviewVisible) {
            e.preventDefault();
            togglePreviewExpanded();
          }
          break;

        case 'r':
          // Reset view
          if (isPreviewVisible) {
            e.preventDefault();
            sceneRef.current?.resetView();
          }
          break;

        case 'Escape':
          // Close expanded view
          if (isPreviewVisible && isPreviewExpanded) {
            e.preventDefault();
            setPreviewExpanded(false);
          }
          break;

        case '1':
          // Camera preset: Isometric view
          if (isPreviewVisible) {
            e.preventDefault();
            sceneRef.current?.setPreset('isometric');
          }
          break;

        case '2':
          // Camera preset: Front view
          if (isPreviewVisible) {
            e.preventDefault();
            sceneRef.current?.setPreset('front');
          }
          break;

        case '3':
          // Camera preset: Side view
          if (isPreviewVisible) {
            e.preventDefault();
            sceneRef.current?.setPreset('side');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    sceneRef,
    isPreviewVisible,
    isPreviewExpanded,
    togglePreviewVisibility,
    togglePreviewExpanded,
    setPreviewExpanded,
  ]);
}
