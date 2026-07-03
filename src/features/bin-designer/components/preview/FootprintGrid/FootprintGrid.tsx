/**
 * Infinite-fade Gridfinity grid for the bin designer 3D preview.
 * Uses a custom fragment shader to render a grid at gridUnitMm intervals
 * (default 42mm) aligned with the bin's grid cell boundaries, fading out
 * radially. The bin sits correctly on top of the grid cells it occupies.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { positivePitch } from './footprintGridMath';

interface FootprintGridProps {
  /** Bin width in grid units */
  width: number;
  /** Bin depth in grid units */
  depth: number;
  /** Grid unit in mm along X / width (defaults to standard 42mm) */
  gridUnitMm?: number;
  /** Optional grid unit in mm along Y / depth (non-square grid); defaults to gridUnitMm */
  gridUnitMmY?: number;
}

/** How many grid units the floor extends beyond the bin footprint */
const GRID_EXTENT = 14;
/** Minimum floor size as a multiple of one grid unit */
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
  uniform vec2 gridSize;
  uniform vec2 gridOffset;
  uniform float fadeStart;
  uniform float fadeEnd;
  uniform vec3 lineColor;
  uniform float lineOpacity;

  varying vec2 vWorldPos;

  void main() {
    // Offset world position so grid lines align with bin cell boundaries
    vec2 alignedPos = vWorldPos + gridOffset;

    // Grid line computation using derivatives for anti-aliased lines.
    // gridSize is per-axis (x = width pitch, y = depth pitch) so a non-square
    // grid draws rectangular cells; division is component-wise.
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
 * Grid lines at `gridUnitMm` intervals (Gridfinity standard = 42mm) are
 * aligned with the bin's cell boundaries, so the bin appears correctly
 * placed on the grid cells it occupies.
 */
export function FootprintGrid({ width, depth, gridUnitMm, gridUnitMmY }: FootprintGridProps) {
  const colors = useThreeColors();
  const GSX = positivePitch(gridUnitMm, GRIDFINITY.GRID_SIZE);
  const GSY = positivePitch(gridUnitMmY, GSX);
  // Floor extent uses the larger pitch so the "infinite" floor always covers the
  // bin on both axes.
  const GSmax = Math.max(GSX, GSY);
  // Floor size: extends well beyond the bin for the "infinite" illusion
  const maxDim = Math.max(width, depth);
  const floorSize = Math.max((maxDim + GRID_EXTENT * 2) * GSmax, GSmax * MIN_FLOOR_GRID_UNITS);

  // Grid offset: shift the grid pattern so lines align with the bin's cell boundaries
  // The bin is centered at origin, so offset by half the nominal width/depth (per axis)
  const offsetX = (width * GSX) / 2;
  const offsetY = (depth * GSY) / 2;

  // Fade distances: grid stays crisp near the bin, fades out toward edges
  const fadeStart = (maxDim / 2 + 4) * GSmax;
  const fadeEnd = (maxDim / 2 + GRID_EXTENT) * GSmax;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      uniforms: {
        gridSize: { value: new THREE.Vector2(GSX, GSY) },
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
  }, [GSX, GSY, offsetX, offsetY, fadeStart, fadeEnd, colors.footprintLine]);

  // Dispose shader material on unmount/change
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh position={[0, 0, 0]} material={material}>
      <planeGeometry args={[floorSize, floorSize]} />
    </mesh>
  );
}
