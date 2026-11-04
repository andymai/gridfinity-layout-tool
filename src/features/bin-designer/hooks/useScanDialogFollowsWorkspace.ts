import { useEffect } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';

/**
 * The scan dialog lives in the cut editor's workspace. When the workspace stops
 * showing (an undo out of Custom Cutouts, a window too narrow for it) the
 * dialog closes rather than waiting to reappear. Judged from state, not from
 * the workspace unmounting, because the workspace remounts when a new design
 * takes over and the dialog has to survive that.
 *
 * The phone flow follows its own layout the same way: a window widened past
 * the breakpoint unmounts it, so it closes too, and narrowing the window again
 * doesn't bring back a fresh flow nobody asked for.
 */
export function useScanDialogFollowsWorkspace(
  workspaceShown: boolean,
  phoneFlowShown: boolean
): void {
  const scanDialogOpen = useDesignerStore((s) => s.ui.scanDialogSource !== null);
  const phoneScanOpen = useDesignerStore((s) => s.ui.phoneScanSource !== null);
  const closeScanDialog = useDesignerStore((s) => s.closeScanDialog);
  const closePhoneScan = useDesignerStore((s) => s.closePhoneScan);
  useEffect(() => {
    if (scanDialogOpen && !workspaceShown) closeScanDialog();
  }, [scanDialogOpen, workspaceShown, closeScanDialog]);
  useEffect(() => {
    if (phoneScanOpen && !phoneFlowShown) closePhoneScan();
  }, [phoneScanOpen, phoneFlowShown, closePhoneScan]);
  useEffect(
    () => () => {
      closeScanDialog();
      closePhoneScan();
    },
    [closeScanDialog, closePhoneScan]
  );
}
