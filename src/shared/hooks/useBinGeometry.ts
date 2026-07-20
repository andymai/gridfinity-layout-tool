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
    const darkenAmount = -brightness;
    hsl.l = hsl.l * (1 - darkenAmount * 0.8);

    const blueHue = 0.6;
    const hueShift = darkenAmount * 0.08; // Subtle shift
    hsl.h = hsl.h + (blueHue - hsl.h) * hueShift;

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

  const faceColors = createFaceColors(faceColor);
  colors.push(...faceColors);
}

// Minimum divider wall thickness in grid units (~1.26mm at 42mm) so thin
// real-world dividers stay visible at preview scale
const MIN_DIVIDER_THICKNESS = 0.03;

/**
 * One axis-aligned divider wall segment, positioned in fractions (0-1) of the
 * bin's interior span. Vertical segments run along the depth axis at x;
 * horizontal segments run along the width axis at y.
 */
export interface BinDividerSegment {
  x: number;
  y: number;
  length: number;
  orientation: 'horizontal' | 'vertical';
}

/** Compartment divider walls to render inside the bin cavity. */
export interface BinDividersSpec {
  /** Stable identity for geometry caching (designId:updatedAt). */
  sig: string;
  segments: BinDividerSegment[];
  /** Divider wall thickness in scene grid units. */
  thickness: number;
  /** Divider height in scene grid units, or null for full interior height. */
  height: number | null;
}

interface BinGeometryProps {
  width: number;
  depth: number;
  height: number;
  baseColor: string;
  /** Interior compartment dividers (from a linked bin-designer design). */
  dividers?: BinDividersSpec;
}

/**
 * Creates custom BufferGeometry for an open-top Gridfinity bin.
 * Generates exterior walls, interior cavity, and top rim with per-face vertex colors.
 * This is the standalone function - use useBinGeometry hook for React components.
 */
export function createBinGeometry({
  width,
  depth,
  height,
  baseColor,
  dividers,
}: BinGeometryProps): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];

  const color = new THREE.Color(baseColor);
  const zGap = 0.03; // Small lift off floor
  const BEVEL = 0.04; // Bevel size for rounded top edges

  // Outer corners
  const x0 = 0,
    x1 = width;
  const y0 = 0,
    y1 = depth;
  const z0 = zGap,
    z1 = height;

  // Beveled top edge positions (inset from outer edges)
  const bx0 = BEVEL,
    bx1 = width - BEVEL;
  const by0 = BEVEL,
    by1 = depth - BEVEL;
  const bz = z1 - BEVEL; // Start of bevel in Z

  // Inner corners (cavity)
  const ix0 = WALL_THICKNESS,
    ix1 = width - WALL_THICKNESS;
  const iy0 = WALL_THICKNESS,
    iy1 = depth - WALL_THICKNESS;

  // Use base color for outer walls - let PBR materials handle lighting
  // This preserves category colors more accurately
  const outerWallColor = color;

  // Walls go from bottom (z0) to bevel start (bz)
  // Front wall (y=0)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y0, z0),
    new THREE.Vector3(x1, y0, z0),
    new THREE.Vector3(x1, y0, bz),
    new THREE.Vector3(x0, y0, bz),
    outerWallColor
  );

  // Right wall (x=width)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x1, y0, z0),
    new THREE.Vector3(x1, y1, z0),
    new THREE.Vector3(x1, y1, bz),
    new THREE.Vector3(x1, y0, bz),
    outerWallColor
  );

  // Back wall (y=depth)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x1, y1, z0),
    new THREE.Vector3(x0, y1, z0),
    new THREE.Vector3(x0, y1, bz),
    new THREE.Vector3(x1, y1, bz),
    outerWallColor
  );

  // Left wall (x=0)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y1, z0),
    new THREE.Vector3(x0, y0, z0),
    new THREE.Vector3(x0, y0, bz),
    new THREE.Vector3(x0, y1, bz),
    outerWallColor
  );

  // Chamfered edges from bz to z1, angling inward
  const bevelColor = color;

  // Front bevel (y=0 to by0)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y0, bz),
    new THREE.Vector3(x1, y0, bz),
    new THREE.Vector3(bx1, by0, z1),
    new THREE.Vector3(bx0, by0, z1),
    bevelColor
  );

  // Right bevel (x=width to bx1)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x1, y0, bz),
    new THREE.Vector3(x1, y1, bz),
    new THREE.Vector3(bx1, by1, z1),
    new THREE.Vector3(bx1, by0, z1),
    bevelColor
  );

  // Back bevel (y=depth to by1)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x1, y1, bz),
    new THREE.Vector3(x0, y1, bz),
    new THREE.Vector3(bx0, by1, z1),
    new THREE.Vector3(bx1, by1, z1),
    bevelColor
  );

  // Left bevel (x=0 to bx0)
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y1, bz),
    new THREE.Vector3(x0, y0, bz),
    new THREE.Vector3(bx0, by0, z1),
    new THREE.Vector3(bx0, by1, z1),
    bevelColor
  );

  // Bottom face (slightly darkened) - winding order for upward-facing normal
  const exteriorFloorColor = adjustColor(color, -0.08);
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y0, z0),
    new THREE.Vector3(x1, y0, z0),
    new THREE.Vector3(x1, y1, z0),
    new THREE.Vector3(x0, y1, z0),
    exteriorFloorColor
  );

  // Interior surfaces use offset Z positions to prevent Z-fighting with exterior surfaces
  const interiorFloorZ = z0 + INTERIOR_OFFSET;
  const interiorCeilingZ = z1 - INTERIOR_OFFSET;

  // Interior floor (30% darkened - HSL-based for proper shadow hue)
  const interiorFloorColor = adjustColor(color, -0.3);

  addQuad(
    positions,
    colors,
    new THREE.Vector3(ix0, iy0, interiorFloorZ),
    new THREE.Vector3(ix0, iy1, interiorFloorZ),
    new THREE.Vector3(ix1, iy1, interiorFloorZ),
    new THREE.Vector3(ix1, iy0, interiorFloorZ),
    interiorFloorColor
  );

  // Interior walls (20% darkened - HSL-based for proper shadow hue)
  // Note: Only 2 inner walls are visible from any given angle
  // For simplicity, we'll render all 4 and let z-buffer handle visibility
  const interiorWallColor = adjustColor(color, -0.2);

  // Inner front wall
  addQuad(
    positions,
    colors,
    new THREE.Vector3(ix0, iy0, interiorFloorZ),
    new THREE.Vector3(ix1, iy0, interiorFloorZ),
    new THREE.Vector3(ix1, iy0, interiorCeilingZ),
    new THREE.Vector3(ix0, iy0, interiorCeilingZ),
    interiorWallColor
  );

  // Inner right wall
  addQuad(
    positions,
    colors,
    new THREE.Vector3(ix1, iy0, interiorFloorZ),
    new THREE.Vector3(ix1, iy1, interiorFloorZ),
    new THREE.Vector3(ix1, iy1, interiorCeilingZ),
    new THREE.Vector3(ix1, iy0, interiorCeilingZ),
    interiorWallColor
  );

  // Inner back wall
  addQuad(
    positions,
    colors,
    new THREE.Vector3(ix1, iy1, interiorFloorZ),
    new THREE.Vector3(ix0, iy1, interiorFloorZ),
    new THREE.Vector3(ix0, iy1, interiorCeilingZ),
    new THREE.Vector3(ix1, iy1, interiorCeilingZ),
    interiorWallColor
  );

  // Inner left wall
  addQuad(
    positions,
    colors,
    new THREE.Vector3(ix0, iy1, interiorFloorZ),
    new THREE.Vector3(ix0, iy0, interiorFloorZ),
    new THREE.Vector3(ix0, iy0, interiorCeilingZ),
    new THREE.Vector3(ix0, iy1, interiorCeilingZ),
    interiorWallColor
  );

  // Use base color for top rim - let PBR handle lighting
  const topColor = color;

  // Top rim is a frame connecting outer edge to inner edge
  // Front rim
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y0, z1),
    new THREE.Vector3(x1, y0, z1),
    new THREE.Vector3(ix1, iy0, z1),
    new THREE.Vector3(ix0, iy0, z1),
    topColor
  );

  // Right rim
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x1, y0, z1),
    new THREE.Vector3(x1, y1, z1),
    new THREE.Vector3(ix1, iy1, z1),
    new THREE.Vector3(ix1, iy0, z1),
    topColor
  );

  // Back rim
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x1, y1, z1),
    new THREE.Vector3(x0, y1, z1),
    new THREE.Vector3(ix0, iy1, z1),
    new THREE.Vector3(ix1, iy1, z1),
    topColor
  );

  // Left rim
  addQuad(
    positions,
    colors,
    new THREE.Vector3(x0, y1, z1),
    new THREE.Vector3(x0, y0, z1),
    new THREE.Vector3(ix0, iy0, z1),
    new THREE.Vector3(ix0, iy1, z1),
    topColor
  );

  // Compartment divider walls from a linked design: thin boxes rising from the
  // interior floor, positioned by interior-span fractions so they track the
  // preview's own wall thickness rather than the design's physical walls.
  if (dividers && dividers.segments.length > 0) {
    const innerW = ix1 - ix0;
    const innerD = iy1 - iy0;
    const halfThickness = Math.max(dividers.thickness, MIN_DIVIDER_THICKNESS) / 2;
    const dividerTopZ =
      dividers.height === null
        ? interiorCeilingZ
        : Math.min(interiorCeilingZ, interiorFloorZ + dividers.height);
    const dividerSideColor = interiorWallColor;
    const dividerTopColor = adjustColor(color, -0.05);

    for (const segment of dividers.segments) {
      let dx0: number, dx1: number, dy0: number, dy1: number;
      if (segment.orientation === 'vertical') {
        const centerX = ix0 + segment.x * innerW;
        dx0 = centerX - halfThickness;
        dx1 = centerX + halfThickness;
        dy0 = iy0 + segment.y * innerD;
        dy1 = dy0 + segment.length * innerD;
      } else {
        const centerY = iy0 + segment.y * innerD;
        dy0 = centerY - halfThickness;
        dy1 = centerY + halfThickness;
        dx0 = ix0 + segment.x * innerW;
        dx1 = dx0 + segment.length * innerW;
      }

      // Clamp into the cavity so dividers never poke through exterior walls
      dx0 = Math.max(ix0, dx0);
      dx1 = Math.min(ix1, dx1);
      dy0 = Math.max(iy0, dy0);
      dy1 = Math.min(iy1, dy1);
      if (dx1 <= dx0 || dy1 <= dy0 || dividerTopZ <= interiorFloorZ) continue;

      // Front face (y = dy0)
      addQuad(
        positions,
        colors,
        new THREE.Vector3(dx0, dy0, interiorFloorZ),
        new THREE.Vector3(dx1, dy0, interiorFloorZ),
        new THREE.Vector3(dx1, dy0, dividerTopZ),
        new THREE.Vector3(dx0, dy0, dividerTopZ),
        dividerSideColor
      );

      // Right face (x = dx1)
      addQuad(
        positions,
        colors,
        new THREE.Vector3(dx1, dy0, interiorFloorZ),
        new THREE.Vector3(dx1, dy1, interiorFloorZ),
        new THREE.Vector3(dx1, dy1, dividerTopZ),
        new THREE.Vector3(dx1, dy0, dividerTopZ),
        dividerSideColor
      );

      // Back face (y = dy1)
      addQuad(
        positions,
        colors,
        new THREE.Vector3(dx1, dy1, interiorFloorZ),
        new THREE.Vector3(dx0, dy1, interiorFloorZ),
        new THREE.Vector3(dx0, dy1, dividerTopZ),
        new THREE.Vector3(dx1, dy1, dividerTopZ),
        dividerSideColor
      );

      // Left face (x = dx0)
      addQuad(
        positions,
        colors,
        new THREE.Vector3(dx0, dy1, interiorFloorZ),
        new THREE.Vector3(dx0, dy0, interiorFloorZ),
        new THREE.Vector3(dx0, dy0, dividerTopZ),
        new THREE.Vector3(dx0, dy1, dividerTopZ),
        dividerSideColor
      );

      // Top face
      addQuad(
        positions,
        colors,
        new THREE.Vector3(dx0, dy0, dividerTopZ),
        new THREE.Vector3(dx1, dy0, dividerTopZ),
        new THREE.Vector3(dx1, dy1, dividerTopZ),
        new THREE.Vector3(dx0, dy1, dividerTopZ),
        dividerTopColor
      );
    }
  }

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
export function useBinGeometry({
  width,
  depth,
  height,
  baseColor,
  dividers,
}: BinGeometryProps): THREE.BufferGeometry {
  const geometry = useMemo(
    () => createBinGeometry({ width, depth, height, baseColor, dividers }),
    [width, depth, height, baseColor, dividers]
  );

  // Cleanup geometry on dependency change or unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return geometry;
}
