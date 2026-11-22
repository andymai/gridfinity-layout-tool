/**
 * Whether the designer is building its preview, for background renders that
 * share its generation bridge: a new bridge request cancels the one before it.
 */

import { useDesignerStore } from '@/features/bin-designer/store/designer';

export function editorBuilding(): boolean {
  return useDesignerStore.getState().generation.status === 'generating';
}

/** Resolve once the designer is not building its preview. */
export function untilEditorIdle(): Promise<void> {
  if (!editorBuilding()) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = useDesignerStore.subscribe((state) => {
      if (state.generation.status === 'generating') return;
      stop();
      resolve();
    });
  });
}
