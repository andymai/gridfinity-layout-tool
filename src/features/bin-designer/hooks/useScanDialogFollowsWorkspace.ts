import { useEffect } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';

/**
 * The scan dialog lives in the cut editor's workspace. When the workspace stops
 * showing (an undo out of Custom Cutouts, a window too narrow for it) the
 * dialog closes rather than waiting to reappear. Judged from state, not from
 * the workspace unmounting, because the workspace remounts when a new design
 * takes over and the dialog has to survive that.
 */
export function useScanDialogFollowsWorkspace(workspaceShown: boolean): void {
  const scanDialogOpen = useDesignerStore((s) => s.ui.scanDialogSource !== null);
  const closeScanDialog = useDesignerStore((s) => s.closeScanDialog);
  useEffect(() => {
    if (scanDialogOpen && !workspaceShown) closeScanDialog();
  }, [scanDialogOpen, workspaceShown, closeScanDialog]);
}
