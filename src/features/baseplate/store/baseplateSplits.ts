import type { BaseplateDesignId, LayoutId } from '@/core/types';

type SplitListener = (layoutId: LayoutId, fromDesignId: BaseplateDesignId) => void;

const listeners = new Set<SplitListener>();

/**
 * The library init gave a layout its own copy of a design it shared. The copy
 * already holds the layout's plate, so an edit still on its way to the shared
 * design would put this layout's plate on the other layouts.
 */
export function announceBaseplateSplit(layoutId: LayoutId, fromDesignId: BaseplateDesignId): void {
  for (const listener of listeners) listener(layoutId, fromDesignId);
}

export function onBaseplateSplit(listener: SplitListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
