/**
 * Warns users before closing the tab when they have unsaved designer changes.
 *
 * Registers a `beforeunload` handler when the current design has no saved ID
 * (i.e. untitled) and the user has made at least one change (undo history exists).
 */

import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';
import { useBeforeUnloadGuard } from '@/shared/hooks/useBeforeUnloadGuard';

export function useUnsavedWarning(): void {
  const { hasUnsavedChanges } = useDesignerStore(
    useShallow((s) => ({
      hasUnsavedChanges: s.currentDesignId === null && s.history.past.length > 0,
    }))
  );

  useBeforeUnloadGuard(hasUnsavedChanges);
}
