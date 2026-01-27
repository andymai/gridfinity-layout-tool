/**
 * Container for all design linking dialogs.
 *
 * Renders all dialogs that are controlled by the linking store.
 * Each dialog uses createPortal to render to document.body.
 * Include this component once in your app (e.g., in App.tsx).
 */

import { CreateDesignDialog } from './Dialogs/CreateDesignDialog';
import { SyncDimensionsDialog } from './Dialogs/SyncDimensionsDialog';
import { DeleteDesignWarningDialog } from './Dialogs/DeleteDesignWarningDialog';

export function DesignLinkingDialogs() {
  return (
    <>
      <CreateDesignDialog />
      <SyncDimensionsDialog />
      <DeleteDesignWarningDialog />
    </>
  );
}
