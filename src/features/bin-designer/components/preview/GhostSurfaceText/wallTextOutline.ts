/**
 * The wall captions' outline in preview world space, as `GhostSurfaceText`
 * draws it. The face transforms here mirror `wallTextBuilder`.
 */

import * as THREE from 'three';
import type { BinParams, WallTextFace, WallTextSide } from '@/shared/types/bin';
import { baseFloorZ, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { labelTabInteriorDims } from '@/shared/utils/labelTabPlan';
import { computeWallTextLayouts, wallTextReadingSign } from '@/shared/utils/wallTextPlan';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { contourSegments, outlineToContours } from './ghostTextGeometry';

/** Lift off the wall face so the outline never z-fights the solid behind it. */
const FACE_LIFT_MM = 0.06;

/** Yaw (degrees about +Z) turning a front-facing glyph run toward each wall. */
const WALL_YAW: Record<WallTextSide, number> = { front: 0, back: 180, left: -90, right: 90 };

const OPPOSITE_WALL: Record<WallTextSide, WallTextSide> = {
  front: 'back',
  back: 'front',
  left: 'right',
  right: 'left',
};

function wallFaceTranslation(
  side: WallTextSide,
  face: WallTextFace,
  innerW: number,
  innerD: number,
  wallThickness: number
): [number, number] {
  const outward = face === 'inside' ? -FACE_LIFT_MM : wallThickness + FACE_LIFT_MM;
  switch (side) {
    case 'front':
      return [0, -(innerD / 2 + outward)];
    case 'back':
      return [0, innerD / 2 + outward];
    case 'left':
      return [-(innerW / 2 + outward), 0];
    case 'right':
      return [innerW / 2 + outward, 0];
  }
}

function buildGeometry(positions: number[]): THREE.BufferGeometry | null {
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Positions for every wall caption's outline, in preview world space. */
export function buildWallTextOutline(
  params: BinParams,
  measurer: TypeMeasurer
): THREE.BufferGeometry | null {
  // The worker's own cavity: overhang widens and shifts it, and the inside
  // face is placed against it.
  const heights = labelTabInteriorDims(params);
  if (!heights) return null;
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
  const floorZ = baseFloorZ(params.base, params.heightUnitMm, params.lid, params.cellMask);

  const layouts = computeWallTextLayouts(
    params,
    {
      innerW,
      innerD,
      wallHeight: heights.wallHeight,
      interiorHeight: heights.interiorHeight,
      solid: params.base.solid,
      isSlotted: params.style === 'slotted',
    },
    measurer
  );
  if (layouts.length === 0) return null;

  const positions: number[] = [];
  for (const layout of layouts) {
    const sign = wallTextReadingSign(layout.side, layout.face);
    const yawSide = layout.face === 'inside' ? OPPOSITE_WALL[layout.side] : layout.side;
    const yaw = (WALL_YAW[yawSide] * Math.PI) / 180;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const [tx, ty] = wallFaceTranslation(
      layout.side,
      layout.face,
      innerW,
      innerD,
      params.wallThickness
    );
    // Reading-frame origin of the chosen rect, matching `wallTextBuilder`.
    const originU = sign * layout.rectCenterU;
    const originZ = layout.rectCenterZ;

    for (const line of layout.plan.lines) {
      for (const glyph of line.glyphs) {
        if (glyph.char.trim() === '') continue;
        const commands = measurer.outline(glyph.char, layout.plan.font);
        if (!commands) continue;
        const contours = outlineToContours(
          commands,
          line.fontSize,
          originU + line.x + glyph.x,
          originZ + line.baselineY
        );
        for (const contour of contours) {
          const segments = contourSegments(contour);
          for (let i = 0; i + 1 < segments.length; i += 2) {
            const px = segments[i];
            const py = segments[i + 1];
            positions.push(px * cos + tx + offsetX, px * sin + ty + offsetY, floorZ + py);
          }
        }
      }
    }
  }
  return buildGeometry(positions);
}
