import { useLayoutStore } from '../../../core/store';

/**
 * Returns true if advanced layer mode should be shown.
 * True when user has 2+ layers.
 */
export function useAdvancedLayerMode(): boolean {
  const layerCount = useLayoutStore((state) => state.layout.layers.length);
  return layerCount > 1;
}
