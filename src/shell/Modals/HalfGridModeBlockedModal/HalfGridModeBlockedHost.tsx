import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { batch } from '@/core/cqrs';
import { useHalfGridModeStore, useLayoutStore, useToastStore } from '@/core/store';
import { STAGING_ID } from '@/core/constants';
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
  const { updateBin } = useMutations();

  const handleRemediate = useCallback(() => {
    // Read the bins again on confirm: a collaborator or an undo can change
    // them while the dialog is open, and any bin left on a half unit would
    // stay stuck there once the mode is off.
    const { violation } = validateHalfGridModeToggle(useLayoutStore.getState().layout, false);
    let movedCount = 0;
    batch(() => {
      for (const id of violation?.binIds ?? []) {
        if (isOk(updateBin(toBinId(id), { layerId: STAGING_ID }))) movedCount++;
      }
      setHalfGridMode(false);
    });
    dismissBlockedViolation();
    if (movedCount > 0) addToast(t('toast.movedToStash', { count: movedCount }), 'success');
  }, [updateBin, setHalfGridMode, dismissBlockedViolation, addToast, t]);

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
