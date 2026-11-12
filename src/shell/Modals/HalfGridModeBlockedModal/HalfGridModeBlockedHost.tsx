import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { batch } from '@/core/cqrs';
import { useHalfGridModeStore, useLayoutStore, useToastStore } from '@/core/store';
import { binId as toBinId } from '@/core/types';
import { isOk } from '@/core/result';
import { useMutations } from '@/shared/contexts';
import { validateHalfGridModeToggle } from '@/shared/utils/halfGridConstraints';
import { useTranslation } from '@/i18n';
import { HalfGridModeBlockedModal } from './HalfGridModeBlockedModal';

export function HalfGridModeBlockedHost() {
  const t = useTranslation();
  const { blockedViolation, blockedLayoutId, dismissBlockedViolation, setHalfGridMode } =
    useHalfGridModeStore(
      useShallow((s) => ({
        blockedViolation: s.blockedViolation,
        blockedLayoutId: s.blockedLayoutId,
        dismissBlockedViolation: s.dismissBlockedViolation,
        setHalfGridMode: s.setHalfGridMode,
      }))
    );
  const activeLayoutId = useLayoutStore((s) => s.activeLayoutId);
  // Browser Back and Forward switch layouts under an open dialog. Its count and
  // its confirm belong to the layout that blocked the turn-off.
  const isForOtherLayout = blockedViolation !== null && blockedLayoutId !== activeLayoutId;
  const addToast = useToastStore((s) => s.addToast);
  const { moveBinsToStaging } = useMutations();

  const handleRemediate = useCallback(() => {
    // Read the bins again on confirm: a collaborator or an undo can change
    // them while the dialog is open, and any bin left on a half unit would
    // stay stuck there once the mode is off.
    const { violation } = validateHalfGridModeToggle(useLayoutStore.getState().layout, false);
    // Each id is a grid bin of the layout read just above, so the batch
    // command moves every one of them.
    const ids = (violation?.binIds ?? []).map(toBinId);
    const stashed = batch(() => {
      const result = ids.length > 0 && isOk(moveBinsToStaging(ids));
      setHalfGridMode(false);
      return result;
    });
    dismissBlockedViolation();
    if (stashed) addToast(t('toast.movedToStash', { count: ids.length }), 'success');
  }, [moveBinsToStaging, setHalfGridMode, dismissBlockedViolation, addToast, t]);

  useEffect(() => {
    if (isForOtherLayout) dismissBlockedViolation();
  }, [isForOtherLayout, dismissBlockedViolation]);

  if (!blockedViolation || isForOtherLayout) return null;
  return (
    <HalfGridModeBlockedModal
      isOpen
      violation={blockedViolation}
      onClose={dismissBlockedViolation}
      onRemediate={handleRemediate}
    />
  );
}
