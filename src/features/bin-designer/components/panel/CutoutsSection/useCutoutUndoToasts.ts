/**
 * Undo/redo wrappers that emit toast feedback.
 *
 * Pure UI sugar — the actual undo/redo lives in the host store; this hook
 * just couples it to the shared toast queue so the user gets confirmation.
 */

import { useCallback } from 'react';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';

interface UseCutoutUndoToastsOptions {
  readonly canUndo?: boolean;
  readonly canRedo?: boolean;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
}

export interface CutoutUndoToasts {
  readonly undoWithToast: () => void;
  readonly redoWithToast: () => void;
}

export function useCutoutUndoToasts({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: UseCutoutUndoToastsOptions): CutoutUndoToasts {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const undoWithToast = useCallback(() => {
    if (!canUndo) return;
    onUndo?.();
    addToast({ message: t('toast.undone'), type: 'info', duration: 2000 });
  }, [canUndo, onUndo, addToast, t]);

  const redoWithToast = useCallback(() => {
    if (!canRedo) return;
    onRedo?.();
    addToast({ message: t('toast.redone'), type: 'info', duration: 2000 });
  }, [canRedo, onRedo, addToast, t]);

  return { undoWithToast, redoWithToast };
}
