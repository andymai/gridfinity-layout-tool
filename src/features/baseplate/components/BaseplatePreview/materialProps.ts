/**
 * Shared Three.js material properties for baseplate mesh rendering.
 *
 * Used by BaseplateMesh (crossfade) and PieceMesh (split view) to ensure
 * consistent appearance across all baseplate preview renderers.
 */

import * as THREE from 'three';

/** Standard material settings shared by BaseplateMesh and PieceMesh. */
export const MESH_MATERIAL_PROPS = {
  roughness: 0.45,
  metalness: 0,
  side: THREE.DoubleSide,
  emissiveIntensity: 0.08,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
} as const;

/**
 * Emissive intensity used while the direct-mesh preview is on screen.
 *
 * Lower than the final-mesh value so the slab reads as flatter and slightly
 * less "lit" — combined with desaturation in {@link desaturateColor}, this
 * is enough to telegraph "not the final geometry" without a transparency
 * pass (which would z-fight against the FootprintGrid and DimensionLabels).
 */
export const PREVIEW_EMISSIVE_INTENSITY = 0.02;

/** Edge wireframe material settings shared across all mesh renderers. */
export const EDGE_MATERIAL_PROPS = {
  color: '#000000',
  depthTest: true,
} as const;

/**
 * Pull a hex color toward neutral gray by `amount` (0 = original, 1 = full
 * gray). Used to telegraph "preview / unfinished" on the direct-mesh slab
 * without committing to a single brand-colored tint that would conflict with
 * the user's chosen filament color or the app accent.
 *
 * Implemented as a linear blend with the channel-wise luminance, so the
 * resulting color preserves the filament's perceived brightness — bright
 * filaments tint to a light gray, dark filaments to a dark gray.
 */
export function desaturateColor(hex: string, amount = 0.5): string {
  const parsed = hex.startsWith('#') ? hex.slice(1) : hex;
  if (parsed.length !== 6) return hex;
  const r = parseInt(parsed.slice(0, 2), 16);
  const g = parseInt(parsed.slice(2, 4), 16);
  const b = parseInt(parsed.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const blend = (channel: number): number =>
    Math.round(channel * (1 - amount) + luminance * amount);
  const toHex = (n: number): string => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`;
}
