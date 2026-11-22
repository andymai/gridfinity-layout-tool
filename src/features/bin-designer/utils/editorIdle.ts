/**
 * Whether the designer is building its preview, for background renders that
 * share its generation bridge: a new bridge request cancels the one before it.
 */

import { useDesignerStore } from '@/features/bin-designer/store/designer';

export function editorBuilding(): boolean {
  return useDesignerStore.getState().generation.status === 'generating';
}

/**
 * Resolve once the designer is not building its preview, when `signal`
 * aborts, or after `maxWaitMs`. The bound matters: a designer that unmounts
 * mid-build can leave its status at `generating`, and a render waiting on it
 * holds every thumbnail queued behind it.
 */
export function untilEditorIdle(signal?: AbortSignal, maxWaitMs = 15_000): Promise<void> {
  if (!editorBuilding() || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      stop();
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const stop = useDesignerStore.subscribe((state) => {
      if (state.generation.status !== 'generating') finish();
    });
    const timer = setTimeout(finish, maxWaitMs);
    signal?.addEventListener('abort', finish);
  });
}
