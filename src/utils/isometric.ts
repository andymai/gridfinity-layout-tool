/**
 * Isometric projection utilities for 3D preview rendering.
 * Uses standard isometric projection (30° angle from horizontal).
 */

export type IsometricRotation = number; // Degrees, 0-360

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface IsometricBox {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  opacity: number;
  id: string;
}

// Isometric angles (30° from horizontal)
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const COS_30 = Math.cos(ISO_ANGLE);
const SIN_30 = Math.sin(ISO_ANGLE);

/**
 * Convert 3D coordinates to 2D isometric screen coordinates.
 * @param point 3D point (x, y, z)
 * @param rotation Camera rotation (degrees)
 * @param scale Scale factor (pixels per unit)
 * @returns 2D screen coordinates
 */
export function toIsometric(
  point: Point3D,
  rotation: IsometricRotation,
  scale: number
): Point2D {
  // Apply rotation around Z-axis
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = point.x * cos - point.y * sin;
  const ry = point.x * sin + point.y * cos;

  // Standard isometric projection
  // X-axis goes down-right, Y-axis goes down-left, Z-axis goes up
  const screenX = (rx - ry) * COS_30 * scale;
  const screenY = (rx + ry) * SIN_30 * scale - point.z * scale;

  return { x: screenX, y: screenY };
}

/**
 * Get the 8 corners of a 3D box for rendering.
 */
export function getBoxCorners(box: IsometricBox): Point3D[] {
  const { x, y, z, width, depth, height } = box;
  return [
    { x, y, z },                           // 0: front-bottom-left
    { x: x + width, y, z },                // 1: front-bottom-right
    { x: x + width, y: y + depth, z },     // 2: back-bottom-right
    { x, y: y + depth, z },                // 3: back-bottom-left
    { x, y, z: z + height },               // 4: front-top-left
    { x: x + width, y, z: z + height },    // 5: front-top-right
    { x: x + width, y: y + depth, z: z + height }, // 6: back-top-right
    { x, y: y + depth, z: z + height },    // 7: back-top-left
  ];
}

/**
 * Get visible faces of an isometric box based on rotation.
 * Returns indices into corners array for each visible face.
 */
export function getVisibleFaces(rotation: IsometricRotation): {
  top: number[];
  left: number[];
  right: number[];
} {
  // Normalize to nearest 90 degrees for face selection
  const r = Math.round(((rotation % 360) + 360) % 360 / 90) * 90 % 360;

  // Face definitions (counter-clockwise winding)
  // These change based on rotation to show the correct faces
  switch (r) {
    case 0:
      return {
        top: [4, 5, 6, 7],    // Top face
        left: [0, 4, 7, 3],   // Left face (Y+ direction)
        right: [1, 5, 4, 0],  // Right face (X+ direction)
      };
    case 90:
      return {
        top: [4, 5, 6, 7],
        left: [1, 5, 6, 2],   // Rotated left
        right: [0, 4, 5, 1],  // Rotated right
      };
    case 180:
      return {
        top: [4, 5, 6, 7],
        left: [2, 6, 5, 1],
        right: [3, 7, 6, 2],
      };
    case 270:
    default:
      return {
        top: [4, 5, 6, 7],
        left: [3, 7, 4, 0],
        right: [2, 6, 7, 3],
      };
  }
}

/**
 * Calculate depth sort key for painter's algorithm.
 * Lower values are drawn first (further from camera).
 */
export function getDepthSortKey(box: IsometricBox, rotation: IsometricRotation): number {
  const { x, y, z, width, depth, height } = box;

  // Use center for X/Y positioning
  const cx = x + width / 2;
  const cy = y + depth / 2;
  // Use TOP of bin for Z sorting - ensures tall bins that span multiple layers
  // are drawn after shorter bins they might overlap with
  const topZ = z + height;

  // Rotate to get camera-relative position
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = cx * cos - cy * sin;
  const ry = cx * sin + cy * cos;

  // In isometric projection, the camera is at (+∞, +∞, +∞) looking toward origin.
  // Depth from camera = x + y + z (higher = closer to camera = drawn last).
  // All three axes contribute equally (weight = 1) for correct occlusion:
  // - A front layer-1 bin correctly occludes a back layer-2 bin
  // - Stacked bins at same XY still render in layer order (higher Z on top)
  // Using topZ ensures tall bins spanning multiple layers render correctly.
  return (rx + ry) + topZ;
}

/**
 * Sort boxes for correct rendering order (painter's algorithm).
 */
export function sortBoxesForRendering(
  boxes: IsometricBox[],
  rotation: IsometricRotation
): IsometricBox[] {
  return [...boxes].sort((a, b) => {
    const depthA = getDepthSortKey(a, rotation);
    const depthB = getDepthSortKey(b, rotation);
    return depthA - depthB;
  });
}

/**
 * Darken a hex color by a percentage.
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent));
  const b = Math.max(0, (num & 0xff) * (1 - percent));
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by a percentage.
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * percent);
  const b = Math.min(255, (num & 0xff) + (255 - (num & 0xff)) * percent);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

/**
 * Calculate the bounding box of all isometric points.
 */
export function calculateIsometricBounds(
  boxes: IsometricBox[],
  rotation: IsometricRotation,
  scale: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const box of boxes) {
    const corners = getBoxCorners(box);
    for (const corner of corners) {
      const screen = toIsometric(corner, rotation, scale);
      minX = Math.min(minX, screen.x);
      maxX = Math.max(maxX, screen.x);
      minY = Math.min(minY, screen.y);
      maxY = Math.max(maxY, screen.y);
    }
  }

  // Also include origin for empty layouts
  const origin = toIsometric({ x: 0, y: 0, z: 0 }, rotation, scale);
  minX = Math.min(minX, origin.x);
  maxX = Math.max(maxX, origin.x);
  minY = Math.min(minY, origin.y);
  maxY = Math.max(maxY, origin.y);

  return { minX, maxX, minY, maxY };
}
