/**
 * Round-trip math between perspective `distance` and orthographic `zoom` so a
 * runtime projection swap preserves the apparent scale at the target plane.
 *
 * At a perspective distance D with vertical FOV f, the world height visible at
 * the target plane is `2 * D * tan(f/2)`. For an orthographic camera whose
 * frustum spans the viewport pixel height H, `zoom` is the world-units-to-pixel
 * scale at the target: `worldUnitsVisible = H / zoom`. Setting these equal:
 *
 *   zoom = H / (2 * D * tan(f/2))   distance = H / (2 * zoom * tan(f/2))
 *
 * Both sides assume the orthographic frustum is set to pixel-mapped bounds
 * (top/bottom = ±H/2), which is drei's default behavior when explicit bounds
 * are supplied from the canvas size.
 */

/**
 * Convert a perspective camera distance to the orthographic zoom that yields
 * the same on-screen scale at the target plane.
 *
 * @param distance - Perspective camera distance from target, in world units (mm)
 * @param fovDegrees - Perspective vertical FOV in degrees
 * @param viewportHeightPx - Canvas height in pixels (from `useThree().size.height`)
 */
export function distanceToOrthoZoom(
  distance: number,
  fovDegrees: number,
  viewportHeightPx: number
): number {
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180);
  return viewportHeightPx / (2 * distance * Math.tan(halfFovRad));
}

/**
 * Inverse of {@link distanceToOrthoZoom}: convert an orthographic zoom back to
 * the perspective distance that yields the same on-screen scale.
 */
export function orthoZoomToDistance(
  zoom: number,
  fovDegrees: number,
  viewportHeightPx: number
): number {
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180);
  return viewportHeightPx / (2 * zoom * Math.tan(halfFovRad));
}
