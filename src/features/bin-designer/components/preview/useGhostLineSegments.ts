import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useLineMaterialResolution } from './useLineMaterialResolution';

export interface GhostLineStyle {
  readonly color: string;
  readonly opacity: number;
  readonly lineWidth: number;
  /** Draw through the solid (no depth test) for a feature that sits inside the body. */
  readonly throughSolid?: boolean;
}

/**
 * Owns the fat-line material and `LineSegments2` for a ghost outline: built
 * alongside the geometry, kept at the canvas resolution, a frame requested when
 * they appear, and both disposed when the geometry changes or the overlay
 * unmounts.
 */
export function useGhostLineSegments(
  geometry: LineSegmentsGeometry | null,
  style: GhostLineStyle
): LineSegments2 | null {
  const { invalidate } = useThree();
  const { color, opacity, lineWidth, throughSolid = false } = style;

  const material = useMemo(() => {
    if (!geometry) return null;
    return new LineMaterial({
      color: new THREE.Color(color).getHex(),
      linewidth: lineWidth,
      transparent: true,
      opacity,
      depthTest: !throughSolid,
      depthWrite: !throughSolid,
      resolution: new THREE.Vector2(),
    });
  }, [geometry, color, opacity, lineWidth, throughSolid]);

  useLineMaterialResolution(material);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  return useMemo(
    () => (geometry && material ? new LineSegments2(geometry, material) : null),
    [geometry, material]
  );
}
