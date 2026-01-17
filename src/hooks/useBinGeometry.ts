import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

// Wall thickness for open-top bins
const WALL_THICKNESS = 0.08; // Thinner walls (was 0.12)

// Interior surface offset to prevent Z-fighting with exterior surfaces
// Creates a logical "bin shell thickness" - interior floor/walls/ceiling sit inside the exterior shell
const INTERIOR_OFFSET = 0.01;

/**
 * Apply brightness adjustment to a color using proper color theory.
 * Brightness > 0 lightens, < 0 darkens.
 *
 * For shadows (negative brightness):
 * - Decrease lightness
 * - Shift hue slightly toward blue (cooler shadows)
 * - Maintain or boost saturation (shadows aren't gray)
 */
function adjustColor(baseColor: THREE.Color, brightness: number): THREE.Color {
  const result = baseColor.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  result.getHSL(hsl);

  if (brightness > 0) {
    // Lighten: increase lightness toward 1
    hsl.l = hsl.l + (1 - hsl.l) * brightness;
  } else {
    // Darken with color theory:
    // 1. Reduce lightness
    const darkenAmount = -brightness;
    hsl.l = hsl.l * (1 - darkenAmount * 0.8);

    // 2. Shift hue toward blue (0.6 in HSL) for cooler shadows
    const blueHue = 0.6;
    const hueShift = darkenAmount * 0.08; // Subtle shift
    hsl.h = hsl.h + (blueHue - hsl.h) * hueShift;

    // 3. Boost saturation slightly (shadows are rich, not gray)
    hsl.s = Math.min(1, hsl.s * (1 + darkenAmount * 0.2));
  }

  result.setHSL(hsl.h, hsl.s, hsl.l);
  return result;
}

/**
 * Create vertex color array for a quad face (2 triangles = 6 vertices).
 * All 6 vertices get the same color (flat shading per face).
 */
function createFaceColors(color: THREE.Color): Float32Array {
  const colors = new Float32Array(18); // 6 vertices * 3 (RGB)

  for (let i = 0; i < 6; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return colors;
}

/**
 * Add a quad face to the geometry arrays.
 * Vertices are in counter-clockwise order for correct normals.
 */
function addQuad(
  positions: number[],
  colors: number[],
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  v3: THREE.Vector3,
  faceColor: THREE.Color
) {
  // Triangle 1: v0, v1, v2
  positions.push(v0.x, v0.y, v0.z);
  positions.push(v1.x, v1.y, v1.z);
  positions.push(v2.x, v2.y, v2.z);

  // Triangle 2: v0, v2, v3
  positions.push(v0.x, v0.y, v0.z);
  positions.push(v2.x, v2.y, v2.z);
  positions.push(v3.x, v3.y, v3.z);

  // Add colors for all 6 vertices
  const faceColors = createFaceColors(faceColor);
  colors.push(...faceColors);
}

interface BinGeometryProps {
  width: number;
  depth: number;
  height: number;
  baseColor: string;
}

/**
 * Creates custom BufferGeometry for an open-top Gridfinity bin.
 * Generates exterior walls, interior cavity, and top rim with per-face vertex colors.
 * This is the standalone function - use useBinGeometry hook for React components.
 */
export function createBinGeometry({ width, depth, height, baseColor }: BinGeometryProps): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    const color = new THREE.Color(baseColor);
    const zGap = 0.03; // Small lift off floor
    const BEVEL = 0.04; // Bevel size for rounded top edges

    // Outer corners
    const x0 = 0, x1 = width;
    const y0 = 0, y1 = depth;
    const z0 = zGap, z1 = height;

    // Beveled top edge positions (inset from outer edges)
    const bx0 = BEVEL, bx1 = width - BEVEL;
    const by0 = BEVEL, by1 = depth - BEVEL;
    const bz = z1 - BEVEL; // Start of bevel in Z

    // Inner corners (cavity)
    const ix0 = WALL_THICKNESS, ix1 = width - WALL_THICKNESS;
    const iy0 = WALL_THICKNESS, iy1 = depth - WALL_THICKNESS;

    // === OUTER WALLS ===
    // Use base color for outer walls - let PBR materials handle lighting
    // This preserves category colors more accurately
    const outerWallColor = color;

    // Walls go from bottom (z0) to bevel start (bz)
    // Front wall (y=0)
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y0, bz),
      new THREE.Vector3(x0, y0, bz),
      outerWallColor
    );

    // Right wall (x=width)
    addQuad(
      positions, colors,
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x1, y1, bz),
      new THREE.Vector3(x1, y0, bz),
      outerWallColor
    );

    // Back wall (y=depth)
    addQuad(
      positions, colors,
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x0, y1, z0),
      new THREE.Vector3(x0, y1, bz),
      new THREE.Vector3(x1, y1, bz),
      outerWallColor
    );

    // Left wall (x=0)
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y1, z0),
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, y0, bz),
      new THREE.Vector3(x0, y1, bz),
      outerWallColor
    );

    // === TOP EDGE BEVELS ===
    // Chamfered edges from bz to z1, angling inward
    const bevelColor = color;

    // Front bevel (y=0 to by0)
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y0, bz),
      new THREE.Vector3(x1, y0, bz),
      new THREE.Vector3(bx1, by0, z1),
      new THREE.Vector3(bx0, by0, z1),
      bevelColor
    );

    // Right bevel (x=width to bx1)
    addQuad(
      positions, colors,
      new THREE.Vector3(x1, y0, bz),
      new THREE.Vector3(x1, y1, bz),
      new THREE.Vector3(bx1, by1, z1),
      new THREE.Vector3(bx1, by0, z1),
      bevelColor
    );

    // Back bevel (y=depth to by1)
    addQuad(
      positions, colors,
      new THREE.Vector3(x1, y1, bz),
      new THREE.Vector3(x0, y1, bz),
      new THREE.Vector3(bx0, by1, z1),
      new THREE.Vector3(bx1, by1, z1),
      bevelColor
    );

    // Left bevel (x=0 to bx0)
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y1, bz),
      new THREE.Vector3(x0, y0, bz),
      new THREE.Vector3(bx0, by0, z1),
      new THREE.Vector3(bx0, by1, z1),
      bevelColor
    );

    // === EXTERIOR FLOOR ===
    // Bottom face (slightly darkened) - winding order for upward-facing normal
    const exteriorFloorColor = adjustColor(color, -0.08);
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x1, y1, z0),
      new THREE.Vector3(x0, y1, z0),
      exteriorFloorColor
    );

    // === INTERIOR CAVITY ===
    // Interior surfaces use offset Z positions to prevent Z-fighting with exterior surfaces
    const interiorFloorZ = z0 + INTERIOR_OFFSET;
    const interiorCeilingZ = z1 - INTERIOR_OFFSET;

    // Interior floor (30% darkened - HSL-based for proper shadow hue)
    const interiorFloorColor = adjustColor(color, -0.30);

    addQuad(
      positions, colors,
      new THREE.Vector3(ix0, iy0, interiorFloorZ),
      new THREE.Vector3(ix0, iy1, interiorFloorZ),
      new THREE.Vector3(ix1, iy1, interiorFloorZ),
      new THREE.Vector3(ix1, iy0, interiorFloorZ),
      interiorFloorColor
    );

    // Interior walls (20% darkened - HSL-based for proper shadow hue)
    // Note: Only 2 inner walls are visible from any given angle
    // For simplicity, we'll render all 4 and let z-buffer handle visibility
    const interiorWallColor = adjustColor(color, -0.20);

    // Inner front wall
    addQuad(
      positions, colors,
      new THREE.Vector3(ix0, iy0, interiorFloorZ),
      new THREE.Vector3(ix1, iy0, interiorFloorZ),
      new THREE.Vector3(ix1, iy0, interiorCeilingZ),
      new THREE.Vector3(ix0, iy0, interiorCeilingZ),
      interiorWallColor
    );

    // Inner right wall
    addQuad(
      positions, colors,
      new THREE.Vector3(ix1, iy0, interiorFloorZ),
      new THREE.Vector3(ix1, iy1, interiorFloorZ),
      new THREE.Vector3(ix1, iy1, interiorCeilingZ),
      new THREE.Vector3(ix1, iy0, interiorCeilingZ),
      interiorWallColor
    );

    // Inner back wall
    addQuad(
      positions, colors,
      new THREE.Vector3(ix1, iy1, interiorFloorZ),
      new THREE.Vector3(ix0, iy1, interiorFloorZ),
      new THREE.Vector3(ix0, iy1, interiorCeilingZ),
      new THREE.Vector3(ix1, iy1, interiorCeilingZ),
      interiorWallColor
    );

    // Inner left wall
    addQuad(
      positions, colors,
      new THREE.Vector3(ix0, iy1, interiorFloorZ),
      new THREE.Vector3(ix0, iy0, interiorFloorZ),
      new THREE.Vector3(ix0, iy0, interiorCeilingZ),
      new THREE.Vector3(ix0, iy1, interiorCeilingZ),
      interiorWallColor
    );

    // === TOP RIM ===
    // Use base color for top rim - let PBR handle lighting
    const topColor = color;

    // Top rim is a frame connecting outer edge to inner edge
    // Front rim
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(ix1, iy0, z1),
      new THREE.Vector3(ix0, iy0, z1),
      topColor
    );

    // Right rim
    addQuad(
      positions, colors,
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(ix1, iy1, z1),
      new THREE.Vector3(ix1, iy0, z1),
      topColor
    );

    // Back rim
    addQuad(
      positions, colors,
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x0, y1, z1),
      new THREE.Vector3(ix0, iy1, z1),
      new THREE.Vector3(ix1, iy1, z1),
      topColor
    );

    // Left rim
    addQuad(
      positions, colors,
      new THREE.Vector3(x0, y1, z1),
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(ix0, iy0, z1),
      new THREE.Vector3(ix0, iy1, z1),
      topColor
    );

  // Set geometry attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * React hook wrapper for createBinGeometry with memoization.
 * Use this in React components for automatic caching.
 * Properly disposes of geometry when dependencies change or on unmount.
 */
export function useBinGeometry({ width, depth, height, baseColor }: BinGeometryProps): THREE.BufferGeometry {
  const geometry = useMemo(
    () => createBinGeometry({ width, depth, height, baseColor }),
    [width, depth, height, baseColor]
  );

  // Cleanup geometry on dependency change or unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return geometry;
}
