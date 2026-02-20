/**
 * Container for all design linking dialogs and auto-sync listeners.
 *
 * Renders all dialogs that are controlled by the linking store.
 * Each dialog uses createPortal to render to document.body.
 * Also mounts event listeners for bidirectional design-bin auto-sync.
 * Include this component once in your app (e.g., in App.tsx).
 */

import { CreateDesignDialog } from '../Dialogs/CreateDesignDialog';
import { SyncDimensionsDialog } from '../Dialogs/SyncDimensionsDialog';
import { DeleteDesignWarningDialog } from '../Dialogs/DeleteDesignWarningDialog';
import { LinkDesignDialog } from '../Dialogs/LinkDesignDialog';
import { BlockedResizeDialog } from '../Dialogs/BlockedResizeDialog';
import { useDesignSavedListener, useBinResizedListener } from '../../hooks';

export function DesignLinkingDialogs() {
  // Auto-sync listeners (design→bins and bin→design cascade)
  useDesignSavedListener();
  useBinResizedListener();

  return (
    <>
      <CreateDesignDialog />
      <SyncDimensionsDialog />
      <DeleteDesignWarningDialog />
      <LinkDesignDialog />
      <BlockedResizeDialog />
    </>
  );
}
