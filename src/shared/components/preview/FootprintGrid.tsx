/**
 * Infinite-fade Gridfinity grid for the bin designer 3D preview.
 * Uses a custom fragment shader to render a grid at `gridUnitMm`
 * intervals (Gridfinity standard = 42mm) aligned with the bin's grid
 * cell boundaries, fading out radially. The bin sits correctly on top
 * of the grid cells it occupies.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { GRIDFINITY } from '@/shared/constants/bin';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

interface FootprintGridProps {
  /** Bin width in grid units */
  width: number;
  /** Bin depth in grid units */
  depth: number;
  /** Grid unit size in mm (defaults to standard 42mm) */
  gridUnitMm?: number;
}

/** How many grid units the floor extends beyond the bin footprint */
const GRID_EXTENT = 14;
/** Minimum floor size as a multiple of one grid unit (avoids clipping on small bins) */
const MIN_FLOOR_GRID_UNITS = 16;

const gridVertexShader = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xy;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const gridFragmentShader = /* glsl */ `
  uniform float gridSize;
  uniform vec2 gridOffset;
  uniform float fadeStart;
  uniform float fadeEnd;
  uniform vec3 lineColor;
  uniform float lineOpacity;

  varying vec2 vWorldPos;

  void main() {
    // Offset world position so grid lines align with bin cell boundaries
    vec2 alignedPos = vWorldPos + gridOffset;

    // Grid line computation using derivatives for anti-aliased lines
    vec2 grid = abs(fract(alignedPos / gridSize - 0.5) - 0.5);
    vec2 lineWidth = fwidth(alignedPos / gridSize) * 1.5;
    vec2 draw = smoothstep(lineWidth, vec2(0.0), grid);
    float line = max(draw.x, draw.y);

    // Radial fade from center
    float dist = length(vWorldPos);
    float fade = 1.0 - smoothstep(fadeStart, fadeEnd, dist);

    // Grid lines are visible, background is transparent
    float lineAlpha = line * lineOpacity * fade;
    gl_FragColor = vec4(lineColor, lineAlpha);
  }
`;

/**
 * Renders a Gridfinity-sized infinite grid using a custom shader.
 * Grid lines at `gridUnitMm` intervals (default 42mm) are aligned with
 * the bin's cell boundaries, so the bin appears correctly placed on
 * the grid cells it occupies.
 */
export function FootprintGrid({ width, depth, gridUnitMm }: FootprintGridProps) {
  const colors = useThreeColors();
  const GS = gridUnitMm ?? GRIDFINITY.GRID_SIZE;
  // Floor size: extends well beyond the bin for the "infinite" illusion
  const maxDim = Math.max(width, depth);
  const floorSize = Math.max((maxDim + GRID_EXTENT * 2) * GS, GS * MIN_FLOOR_GRID_UNITS);

  // Grid offset: shift the grid pattern so lines align with the bin's cell boundaries
  // The bin is centered at origin, so offset by half the nominal width/depth
  const offsetX = (width * GS) / 2;
  const offsetY = (depth * GS) / 2;

  // Fade distances: grid stays crisp near the bin, fades out toward edges
  const fadeStart = (maxDim / 2 + 4) * GS;
  const fadeEnd = (maxDim / 2 + GRID_EXTENT) * GS;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      uniforms: {
        gridSize: { value: GS },
        gridOffset: { value: new THREE.Vector2(offsetX, offsetY) },
        fadeStart: { value: fadeStart },
        fadeEnd: { value: fadeEnd },
        lineColor: { value: new THREE.Color(colors.footprintLine) },
        lineOpacity: { value: 0.15 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
  }, [GS, offsetX, offsetY, fadeStart, fadeEnd, colors.footprintLine]);

  // Dispose shader material on unmount/change
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh material={material}>
      <planeGeometry args={[floorSize, floorSize]} />
    </mesh>
  );
}
