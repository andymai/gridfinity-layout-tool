/**
 * Wall cutout builder for Gridfinity bins.
 *
 * Generates cutouts in outer walls and interior divider walls with support
 * for u-shape, scoop (semicircle), and funnel (tapered U) profiles.
 */

import { draw, drawRoundedRectangle, drawRectangle, translate, rotate } from 'brepjs';
import type { Shape3D, Drawing } from 'brepjs';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { fuseAllOrNull, findWallSegments } from './compartmentBuilder';
/** Auto-compute corner radius: 15% of the smaller dimension, clamped to [0.5, 5] mm. */
function autoCornerRadius(cutWidth: number, cutHeight: number): number {
  return Math.max(0.5, Math.min(5, Math.min(cutWidth * 0.15, cutHeight * 0.15)));
}

/** Funnel taper ratio: bottom width is 60% of top width. */
const FUNNEL_TAPER_RATIO = 0.6;

/**
 * Build a 2D cutout profile (Drawing) for the given shape.
 *
 * The profile is centered at the origin in 2D space (X = horizontal, Y = vertical).
 * Total height includes overshoot above the wall top.
 *
 * @param cutoutShape - Shape style
 * @param cutWidth - Horizontal span of the cutout in mm
 * @param userCutHeight - User-visible height (depth from wall top) in mm
 * @param overshoot - Extra height above wall top for clean boolean cuts
 */
function buildCutoutProfile(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number
): Drawing {
  const totalHeight = userCutHeight + overshoot;

  switch (cutoutShape) {
    case 'scoop': {
      // Semicircle arc clamped by available height (floor boundary).
      // When cutWidth/2 > userCutHeight, the arc becomes a shallow circular
      // segment instead of a full semicircle.
      const hw = cutWidth / 2;
      const sagitta = Math.min(hw, userCutHeight);
      const topY = totalHeight / 2;
      const arcCenterY = topY - overshoot; // Y where the flat top meets the arc
      return draw([-hw, topY])
        .lineTo([hw, topY])
        .lineTo([hw, arcCenterY])
        .sagittaArc(-cutWidth, 0, sagitta)
        .close();
    }

    case 'funnel': {
      // Tapered U: wider at top, narrower at bottom with rounded corners.
      const cornerR = autoCornerRadius(cutWidth, userCutHeight);
      const safeR = Math.min(cornerR, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);

      const topHW = cutWidth / 2;
      const bottomHW = (cutWidth * FUNNEL_TAPER_RATIO) / 2;
      const topY = totalHeight / 2;
      const bottomY = -totalHeight / 2;

      // Draw trapezoid: top-left -> top-right -> bottom-right -> bottom-left -> close
      let pen = draw([-topHW, topY]).lineTo([topHW, topY]).lineTo([bottomHW, bottomY]);
      if (safeR > 0.1) pen = pen.customCorner(safeR);
      pen = pen.lineTo([-bottomHW, bottomY]);
      if (safeR > 0.1) pen = pen.customCorner(safeR);
      return pen.close();
    }

    default: {
      // U-shape: rounded rectangle (existing behavior)
      const cornerR = autoCornerRadius(cutWidth, userCutHeight);
      const safeR = Math.min(cornerR, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);
      if (safeR > 0.1) {
        return drawRoundedRectangle(cutWidth, totalHeight, safeR);
      }
      return drawRectangle(cutWidth, totalHeight);
    }
  }
}

/**
 * Build a single cutout solid from a 2D profile, extruded and positioned.
 *
 * @returns Positioned Shape3D ready for boolean subtraction
 */
function buildSingleCutout(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number,
  extrudeDepth: number,
  wallHeight: number,
  position: { x: number; y: number; rotateZ: number }
): Shape3D {
  const profile = buildCutoutProfile(cutoutShape, cutWidth, userCutHeight, overshoot);

  // Sketch on XZ plane: X = horizontal span, Z = vertical height.
  // Extrusion goes along -Y (through the wall).
  let shape = sketch(profile, 'XZ').extrude(extrudeDepth);

  // Center extrusion around Y=0 so the cut straddles the wall face.
  shape = translate(shape, [0, extrudeDepth / 2, 0]);

  if (position.rotateZ !== 0) {
    shape = rotate(shape, position.rotateZ, { axis: [0, 0, 1] });
  }

  // Position: bottom of visible cutout at (wallHeight - userCutHeight),
  // shape center is offset upward by overshoot/2 from the visual center
  const cutZ = wallHeight - userCutHeight / 2 + overshoot / 2;
  return translate(shape, [position.x, position.y, cutZ]);
}
/**
 * Build wall cutout cuts for all enabled sides and interior divider walls.
 *
 * Supports multiple cutout shapes: u-shape (rectangular notch with rounded corners),
 * scoop (semicircle), and funnel (tapered U with wider top, narrower bottom).
 */
export function buildWallCutoutCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  if (!params.walls.enabled) return null;

  const wallThickness = params.wallThickness;
  const cutShapes: Shape3D[] = [];
  const cutoutShape = params.walls.shape;

  const resolveEffective = (side: 'front' | 'back' | 'left' | 'right' | 'interior') => {
    const cfg = params.walls[side];
    return cfg.enabled
      ? { effectiveWidth: cfg.width, effectiveDepth: cfg.depth }
      : { effectiveWidth: 0, effectiveDepth: 0 };
  };

  const maxThickness = Math.max(wallThickness, params.compartments.thickness);
  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (maxThickness + lipOverhang) * 2 + 1;
  const overshoot = (hasLip ? LIP_HEIGHT : 0) + 2;

  const sides: Array<{
    key: 'front' | 'back' | 'left' | 'right';
    wallSpan: number;
    x: number;
    y: number;
    rotateZ: number;
  }> = [
    { key: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
    { key: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
    { key: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
    { key: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
  ];

  for (const side of sides) {
    const { effectiveWidth, effectiveDepth } = resolveEffective(side.key);
    if (effectiveWidth <= 0 || effectiveDepth <= 0) continue;

    const cutWidth = side.wallSpan * (effectiveWidth / 100);
    const interiorHeight = wallHeight - wallThickness;
    const userCutHeight = interiorHeight * (effectiveDepth / 100);
    if (cutWidth < 0.1 || userCutHeight < 0.1) continue;

    cutShapes.push(
      buildSingleCutout(cutoutShape, cutWidth, userCutHeight, overshoot, extrudeDepth, wallHeight, {
        x: side.x,
        y: side.y,
        rotateZ: side.rotateZ,
      })
    );
  }

  // Interior divider walls
  if (params.walls.interior.enabled) {
    const { effectiveWidth, effectiveDepth } = resolveEffective('interior');
    if (effectiveWidth > 0 && effectiveDepth > 0) {
      const { cols, rows, cells } = params.compartments;
      if (cols > 1 || rows > 1) {
        const cellW = innerW / cols;
        const cellD = innerD / rows;
        const interiorH = wallHeight - wallThickness;

        const addDividerCutouts = (
          boundaryCount: number,
          segCount: number,
          getCellIds: (boundary: number, i: number) => [number, number],
          getPosition: (
            boundary: number,
            start: number,
            end: number
          ) => { x: number; y: number; rotateZ: number },
          segCellSize: number
        ): void => {
          for (let boundary = 1; boundary < boundaryCount; boundary++) {
            const segments = findWallSegments(segCount, (i) => {
              const [id1, id2] = getCellIds(boundary, i);
              return id1 !== id2;
            });

            for (const [start, end] of segments) {
              const segLength = (end - start) * segCellSize;
              const cutW = segLength * (effectiveWidth / 100);
              const cutH = interiorH * (effectiveDepth / 100);
              if (cutW < 0.1 || cutH < 0.1) continue;

              cutShapes.push(
                buildSingleCutout(
                  cutoutShape,
                  cutW,
                  cutH,
                  overshoot,
                  extrudeDepth,
                  wallHeight,
                  getPosition(boundary, start, end)
                )
              );
            }
          }
        };

        // Vertical divider walls (between columns)
        addDividerCutouts(
          cols,
          rows,
          (boundary, row) => [cells[row * cols + (boundary - 1)], cells[row * cols + boundary]],
          (boundary, start, end) => ({
            x: -innerW / 2 + boundary * cellW,
            y: -innerD / 2 + (start + (end - start) / 2) * cellD,
            rotateZ: 90,
          }),
          cellD
        );

        // Horizontal divider walls (between rows)
        addDividerCutouts(
          rows,
          cols,
          (boundary, col) => [cells[(boundary - 1) * cols + col], cells[boundary * cols + col]],
          (boundary, start, end) => ({
            x: -innerW / 2 + (start + (end - start) / 2) * cellW,
            y: -innerD / 2 + boundary * cellD,
            rotateZ: 0,
          }),
          cellW
        );
      }
    }
  }

  return fuseAllOrNull(cutShapes);
}
