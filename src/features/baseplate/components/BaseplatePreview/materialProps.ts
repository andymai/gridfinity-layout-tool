/**
 * Shared Three.js material properties for baseplate mesh rendering.
 *
 * Used by BaseplateMesh (crossfade) and PieceMesh (split view) to ensure
 * consistent appearance across all baseplate preview renderers.
 */

import * as THREE from 'three';

/** Standard material settings shared by BaseplateMesh and PieceMesh. */
export const MESH_MATERIAL_PROPS = {
  roughness: 0.55,
  metalness: 0,
  side: THREE.DoubleSide,
  emissiveIntensity: 0.1,
  polygonOffset: true,
  polygonOffsetFactor: 4,
  polygonOffsetUnits: 8,
} as const;

/** Edge wireframe material settings shared across all mesh renderers. */
export const EDGE_MATERIAL_PROPS = {
  color: '#1a1a1a',
  transparent: true,
  opacity: 0.4,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -8,
} as const;
