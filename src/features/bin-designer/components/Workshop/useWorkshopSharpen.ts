/**
 * Decides when the Workshop canvas may show the worker's exact fused solid
 * instead of the live proxies: only when a generation has COMPLETED for the
 * epoch the tree is currently at. Any edit bumps the epoch and flips the
 * scene back to proxies instantly; the sharp mesh returns when the worker
 * catches up (the draft-then-sharpen contract the bin designer set).
 */
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

export function useWorkshopSharpen(): boolean {
  const { status, epoch } = useDesignerStore(
    useShallow((s) => ({ status: s.generation.status, epoch: s.generation.epoch }))
  );
  const [sharpEpoch, setSharpEpoch] = useState<number | null>(null);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (status === 'complete' && prevStatusRef.current !== 'complete') {
      setSharpEpoch(epoch);
    }
    prevStatusRef.current = status;
  }, [status, epoch]);

  return status === 'complete' && sharpEpoch === epoch;
}
