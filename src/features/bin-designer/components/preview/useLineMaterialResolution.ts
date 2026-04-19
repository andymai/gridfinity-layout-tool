import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * Sync a LineMaterial's resolution to the canvas size whenever it changes.
 * LineMaterial needs accurate resolution for correct pixel-space line widths.
 * Pass null when the material isn't ready — the effect is a no-op then.
 *
 * Uses useLayoutEffect + invalidate() so the resolution is correct before the
 * first paint and a new frame is scheduled under frameloop="demand".
 */
export function useLineMaterialResolution(material: LineMaterial | null): void {
  const { size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!material) return;
    // Skip pre-measurement frames (0×0) — some drivers render NaN line widths
    // when resolution is zero. r3f will fire a second effect once size is real.
    if (size.width === 0 || size.height === 0) return;
    material.resolution.set(size.width, size.height);
    invalidate();
  }, [material, size.width, size.height, invalidate]);
}
