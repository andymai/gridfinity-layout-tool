/**
 * Adapter hook that provides layout data from the appropriate source.
 *
 * In collaborative mode, returns layout from Liveblocks storage.
 * In local mode, returns layout from Zustand store.
 *
 * This allows components to consume layout data without knowing
 * whether they're in collaborative or local mode.
 *
 * @example
 * ```tsx
 * const { layout, bins, layers, drawer } = useCollabLayout();
 * // Works the same in both collaborative and local modes
 * ```
 */

import { useLayoutStore } from '../core/store/layout';
import { useStorage } from '../liveblocks.config';
import { useCollabMode } from './useCollabMode';
import type { Layout, Bin, Layer, Category, Drawer } from '../core/types';

interface CollabLayoutState {
  /** The full layout object */
  layout: Layout;
  /** Convenience accessor for bins */
  bins: Bin[];
  /** Convenience accessor for layers */
  layers: Layer[];
  /** Convenience accessor for categories */
  categories: Category[];
  /** Convenience accessor for drawer settings */
  drawer: Drawer;
  /** Layout name */
  name: string;
}

/**
 * Returns layout data from either Liveblocks or Zustand based on mode.
 *
 * Note: In collaborative mode, this hook must be used inside a
 * Liveblocks RoomProvider context.
 */
export function useCollabLayout(): CollabLayoutState {
  const { isCollaborative } = useCollabMode();

  // Always call both hooks to satisfy Rules of Hooks
  const localLayout = useLayoutStore((state) => state.layout);

  // Only try to use Liveblocks storage when in collaborative mode
  // When not in RoomProvider, useStorage returns null
  const remoteLayout = useStorage((root) => root?.layout) as Layout | null;

  // Use remote layout in collaborative mode, fall back to local
  const layout = isCollaborative && remoteLayout ? remoteLayout : localLayout;

  return {
    layout,
    bins: layout.bins,
    layers: layout.layers,
    categories: layout.categories,
    drawer: layout.drawer,
    name: layout.name,
  };
}

/**
 * Selector-based version of useCollabLayout for optimized re-renders.
 *
 * @example
 * ```tsx
 * const bins = useCollabLayoutSelector((layout) => layout.bins);
 * ```
 */
export function useCollabLayoutSelector<T>(selector: (layout: Layout) => T): T {
  const { isCollaborative } = useCollabMode();

  // Always call both hooks
  const localResult = useLayoutStore((state) => selector(state.layout));
  const remoteLayout = useStorage((root) => root?.layout) as Layout | null;

  // In collaborative mode with remote data, apply selector to remote
  if (isCollaborative && remoteLayout) {
    return selector(remoteLayout);
  }

  return localResult;
}
