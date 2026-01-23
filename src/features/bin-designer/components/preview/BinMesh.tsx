/**
 * Renders generated bin geometry as a Three.js mesh with normal-based vertex coloring.
 * Applies color theory shading: top faces lighter, sides base color, bottom/interior darker
 * with hue shift toward blue (matching the main grid preview's visual language).
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

/**
 * Converts a hex color string to HSL components.
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return hsl;
}

/**
 * Adjusts an HSL color's brightness using color theory:
 * - Positive brightness: increase lightness toward white
 * - Negative brightness: decrease lightness, shift hue toward blue, boost saturation
 */
function adjustColor(
  hsl: { h: number; s: number; l: number },
  brightness: number
): THREE.Color {
  const adjusted = { ...hsl };

  if (brightness > 0) {
    // Lighten: lerp lightness toward 1
    adjusted.l = adjusted.l + (1 - adjusted.l) * brightness;
  } else {
    const darkenAmount = Math.abs(brightness);
    // Reduce lightness
    adjusted.l = adjusted.l * (1 - darkenAmount * 0.8);
    // Shift hue toward blue (0.6 in HSL) for cooler shadows
    const blueHue = 0.6;
    const hueShift = darkenAmount * 0.15;
    adjusted.h = adjusted.h + (blueHue - adjusted.h) * hueShift;
    // Boost saturation (shadows aren't gray)
    adjusted.s = Math.min(1, adjusted.s * (1 + darkenAmount * 0.2));
  }

  return new THREE.Color().setHSL(adjusted.h, adjusted.s, adjusted.l);
}

/**
 * Computes per-vertex colors based on face normal directions.
 * Creates the illusion of depth and material variation without vertex-color baking in WASM.
 */
function computeVertexColors(
  normals: Float32Array,
  vertexCount: number,
  baseColor: string
): Float32Array {
  const colors = new Float32Array(vertexCount * 3);
  const baseHSL = hexToHSL(baseColor);

  // Pre-compute shaded colors for each face direction
  const topColor = adjustColor(baseHSL, 0.15);      // Top-facing: lighter
  const sideColor = adjustColor(baseHSL, 0);         // Side-facing: base
  const underColor = adjustColor(baseHSL, -0.15);    // Slight underside: slightly darker
  const bottomColor = adjustColor(baseHSL, -0.35);   // Bottom/interior: darkest

  for (let i = 0; i < vertexCount; i++) {
    const nz = normals[i * 3 + 2]; // Z component of normal
    let color: THREE.Color;

    if (nz > 0.7) {
      // Top-facing surfaces (floor of bin looking up, top edges)
      color = topColor;
    } else if (nz < -0.7) {
      // Bottom-facing surfaces (interior ceiling, underside)
      color = bottomColor;
    } else if (nz < -0.2) {
      // Slightly downward-facing (interior walls, overhangs)
      color = underColor;
    } else {
      // Side-facing (main walls)
      color = sideColor;
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return colors;
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { vertices, normals } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
    }))
  );

  const geometry = useMemo(() => {
    if (!vertices || !normals || vertices.length === 0) return null;

    const vertexCount = vertices.length / 3;
    const vertexColors = computeVertexColors(normals, vertexCount, color);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    return geo;
  }, [vertices, normals, color]);

  // Dispose old geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, 0.1]}>
      <meshStandardMaterial
        vertexColors
        roughness={0.4}
        metalness={0}
        wireframe={wireframe}
        side={THREE.DoubleSide}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}
