/**
 * Assembly module — the Dialog implementation lives in sibling modules
 * (dialogStack, useFocusTrap, useBodyScrollLock, DialogRoot, DialogParts,
 * ConfirmDialog). This file only re-exports the public surface so existing
 * './Dialog' imports keep working.
 */

export { useDialogStack, registerDialog, unregisterDialog, isTopmostDialog } from './dialogStack';
export { useFocusTrap } from './useFocusTrap';
export type { DialogInitialFocus } from './useFocusTrap';
export { useBodyScrollLock } from './useBodyScrollLock';
export type { DialogRootProps, DialogRootProps as DialogProps } from './DialogRoot';
export { Dialog } from './DialogParts';
export type {
  DialogHeaderProps,
  DialogSubHeaderProps,
  DialogBodyProps,
  DialogSplitProps,
  DialogSidebarProps,
  DialogPaneProps,
  DialogFooterProps,
} from './DialogParts';
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';
