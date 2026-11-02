import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { BodyType } from './bodyType';
import { switchBodyType } from './bodyTypeMemory';

/** The body-type picker's write: one undo step that gives back what earlier switches cleared. */
export function useBodyTypeSwitch(): (next: BodyType) => void {
  const {
    params,
    bodyTypeMemory,
    setParams,
    setBodyTypeMemory,
    startTransaction,
    commitTransaction,
    updateCutoutConfig,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      bodyTypeMemory: s.ui.bodyTypeMemory,
      setParams: s.setParams,
      setBodyTypeMemory: s.setBodyTypeMemory,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
      updateCutoutConfig: s.updateCutoutConfig,
    }))
  );

  return useCallback(
    (next: BodyType) => {
      const switched = switchBodyType(params, next, bodyTypeMemory);
      if (switched.params === params) return;
      const { topOffset } = switched.params.cutoutConfig;
      startTransaction();
      setParams(switched.params);
      const written = useDesignerStore.getState().params;
      // `setParams` can refuse the write, and the memory must then stay with it.
      if (written !== params) {
        // It also re-holds a floor-referenced fill, over one the switch gave back.
        if (written.cutoutConfig.topOffset !== topOffset) updateCutoutConfig({ topOffset });
        setBodyTypeMemory(switched.memory);
      }
      commitTransaction();
    },
    [
      params,
      bodyTypeMemory,
      setParams,
      setBodyTypeMemory,
      startTransaction,
      commitTransaction,
      updateCutoutConfig,
    ]
  );
}
