import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * Sync a LineMaterial's resolution to the canvas size whenever it changes.
 * LineMaterial needs accurate resolution for correct pixel-space line widths.
 * Pass null when the material isn't ready — the effect is a no-op then.
 */
export function useLineMaterialResolution(material: LineMaterial | null): void {
  const { size } = useThree();
  useEffect(() => {
    if (material) material.resolution.set(size.width, size.height);
  }, [material, size.width, size.height]);
}
