/**
 * Warns users before closing the tab when they have unsaved designer changes.
 *
 * Registers a `beforeunload` handler when the current design has no saved ID
 * (i.e. untitled) and the user has made at least one change (undo history exists).
 */

import { useEffect } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';

export function useUnsavedWarning(): void {
  const { hasUnsavedChanges } = useDesignerStore(
    useShallow((s) => ({
      hasUnsavedChanges: s.currentDesignId === null && s.history.past.length > 0,
    }))
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
}
