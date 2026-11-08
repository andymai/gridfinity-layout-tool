import { useEffect } from 'react';

// Space activates a focused control, and claiming it here would cancel that.
const ACTIVATES_ON_SPACE =
  'button, a[href], select, summary, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="tab"], [role="option"]';

interface Use3DPreviewKeyboardProps {
  isPreviewVisible: boolean;
  isPreviewExpanded: boolean;
  togglePreviewVisibility: () => void;
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;
  toggleExplodedView: () => void;
  isExplodedSupported: boolean;
}

/**
 * Keyboard shortcuts for 3D preview navigation and control.
 * Provides intuitive keyboard navigation for power users.
 */
export function use3DPreviewKeyboard({
  isPreviewVisible,
  isPreviewExpanded,
  togglePreviewVisibility,
  togglePreviewExpanded,
  setPreviewExpanded,
  toggleExplodedView,
  isExplodedSupported,
}: Use3DPreviewKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
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
          if (
            isPreviewVisible &&
            !(target instanceof Element && target.closest(ACTIVATES_ON_SPACE))
          ) {
            e.preventDefault();
            togglePreviewExpanded();
          }
          break;

        case 'Escape':
          // Close expanded view
          if (isPreviewVisible && isPreviewExpanded) {
            e.preventDefault();
            setPreviewExpanded(false);
          }
          break;

        case 'e':
          // Toggle exploded layer view (desktop only, requires multiple layers)
          if (isPreviewVisible && isExplodedSupported) {
            e.preventDefault();
            toggleExplodedView();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isPreviewVisible,
    isPreviewExpanded,
    togglePreviewVisibility,
    togglePreviewExpanded,
    setPreviewExpanded,
    toggleExplodedView,
    isExplodedSupported,
  ]);
}
