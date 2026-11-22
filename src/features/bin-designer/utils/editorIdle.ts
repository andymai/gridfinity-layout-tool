/**
 * Whether the designer is building its preview, for background renders that
 * share its generation bridge: a new bridge request cancels the one before it.
 */

import { useDesignerStore } from '@/features/bin-designer/store/designer';

export function editorBuilding(): boolean {
  return useDesignerStore.getState().generation.status === 'generating';
}

/**
 * True once the designer is not building its preview; false when `signal`
 * aborts or `maxWaitMs` passes first. A caller that gets false must not send
 * a build: it would cancel the editor's. The bound covers a status left at
 * `generating`, which would otherwise hold every render queued behind it.
 */
export function untilEditorIdle(signal?: AbortSignal, maxWaitMs = 15_000): Promise<boolean> {
  if (!editorBuilding()) return Promise.resolve(true);
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (idle: boolean) => {
      stop();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(idle);
    };
    const onAbort = () => finish(false);
    const stop = useDesignerStore.subscribe((state) => {
      if (state.generation.status !== 'generating') finish(true);
    });
    const timer = setTimeout(() => finish(false), maxWaitMs);
    signal?.addEventListener('abort', onAbort);
  });
}
