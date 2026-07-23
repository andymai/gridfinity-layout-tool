import { useLayoutEffect, useSyncExternalStore } from 'react';

// Dialog Stack

const dialogStack: string[] = [];
const dialogStackListeners = new Set<() => void>();

function emitDialogStackChange() {
  dialogStackListeners.forEach((listener) => listener());
}

/**
 * Registers a dialog as the new topmost entry of the module-level stack.
 * Exposed so non-Dialog overlays (e.g. BottomSheet) can participate.
 */
export function registerDialog(id: string): void {
  if (!dialogStack.includes(id)) {
    dialogStack.push(id);
    emitDialogStackChange();
  }
}

/**
 * Removes a dialog from the module-level stack.
 */
export function unregisterDialog(id: string): void {
  const index = dialogStack.indexOf(id);
  if (index !== -1) {
    dialogStack.splice(index, 1);
    emitDialogStackChange();
  }
}

/**
 * Whether the given dialog is the topmost open dialog.
 */
export function isTopmostDialog(id: string): boolean {
  return dialogStack[dialogStack.length - 1] === id;
}

function subscribeToDialogStack(listener: () => void): () => void {
  dialogStackListeners.add(listener);
  return () => dialogStackListeners.delete(listener);
}

/**
 * Registers in the dialog stack while `active`, and returns the live stack
 * position. `depth` drives z-index layering; `isTopmost` gates Escape and
 * focus-trap behavior so nested dialogs don't fight over keyboard input.
 */
export function useDialogStack(id: string, active: boolean): { depth: number; isTopmost: boolean } {
  // useLayoutEffect so depth/isTopmost are correct on first paint when
  // multiple dialogs mount open together.
  useLayoutEffect(() => {
    if (!active) return;
    registerDialog(id);
    return () => unregisterDialog(id);
  }, [id, active]);

  const index = useSyncExternalStore(subscribeToDialogStack, () => dialogStack.indexOf(id));
  const stackSize = useSyncExternalStore(subscribeToDialogStack, () => dialogStack.length);

  return {
    depth: index === -1 ? 0 : index,
    isTopmost: index !== -1 && index === stackSize - 1,
  };
}
