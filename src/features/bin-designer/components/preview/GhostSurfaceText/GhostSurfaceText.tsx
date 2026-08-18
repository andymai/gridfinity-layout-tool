/**
 * Live outline of the wall captions in the 3D preview.
 *
 * Runs the SAME solver the worker runs (`@/shared/utils/wallTextPlan`) against
 * the same font buffers, so anchoring, size, tracking, case and line breaking
 * are shown exactly as they will be cut. That is the whole point of having
 * moved the solver into `shared/`: a preview that re-derived any of it would
 * agree with the print only until one side changed.
 *
 * Drawn as outlines rather than filled glyphs, deliberately. Filling would mean
 * deciding which contours are counters, which is real work for no gain here,
 * and an outline reads as a preview rather than as finished geometry.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { baseFloorZ, baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { computeWallTextLayouts, wallTextReadingSign } from '@/shared/utils/wallTextPlan';
import { resolveEffectiveFont } from '@/shared/utils/typePlan';
import type { OutlineCommand, TypeMeasurer } from '@/shared/utils/typePlan';
import type { WallTextSide } from '@/shared/types/bin';
import { resolveTextStyle, WALL_TEXT_SIDES } from '@/shared/types/bin';
import { useTypeMeasurer } from '@/features/bin-designer/hooks/useTypeMeasurer';

const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.75;
/** Lift off the wall face so the outline never z-fights the solid behind it. */
const FACE_LIFT_MM = 0.06;
/** Segments per curve. A ghost needs the shape, not the tolerance. */
const CURVE_STEPS = 6;

/** Yaw (degrees about +Z) turning a front-facing glyph run toward each wall. */
const WALL_YAW: Record<WallTextSide, number> = { front: 0, back: 180, left: -90, right: 90 };

function wallFaceTranslation(
  side: WallTextSide,
  innerW: number,
  innerD: number,
  wallThickness: number
): [number, number] {
  const outward = wallThickness + FACE_LIFT_MM;
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

/** Flatten one glyph's outline into closed polylines in the reading frame. */
function outlineToContours(
  commands: readonly OutlineCommand[],
  scale: number,
  originX: number,
  originY: number
): number[][] {
  const contours: number[][] = [];
  let current: number[] = [];
  let cx = 0;
  let cy = 0;
  const push = (x: number, y: number): void => {
    current.push(originX + x * scale, originY + y * scale);
    cx = x;
    cy = y;
  };
  const quad = (x1: number, y1: number, x: number, y: number): void => {
    const sx = cx;
    const sy = cy;
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const u = 1 - t;
      push(u * u * sx + 2 * u * t * x1 + t * t * x, u * u * sy + 2 * u * t * y1 + t * t * y);
    }
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): void => {
    const sx = cx;
    const sy = cy;
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const u = 1 - t;
      push(
        u * u * u * sx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
        u * u * u * sy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y
      );
    }
  };

  for (const cmd of commands) {
    if (cmd.type === 'M' && cmd.x !== undefined && cmd.y !== undefined) {
      if (current.length >= 4) contours.push(current);
      current = [];
      push(cmd.x, cmd.y);
    } else if (cmd.type === 'L' && cmd.x !== undefined && cmd.y !== undefined) {
      push(cmd.x, cmd.y);
    } else if (
      cmd.type === 'Q' &&
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      cmd.x1 !== undefined &&
      cmd.y1 !== undefined
    ) {
      quad(cmd.x1, cmd.y1, cmd.x, cmd.y);
    } else if (
      cmd.type === 'C' &&
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      cmd.x1 !== undefined &&
      cmd.y1 !== undefined &&
      cmd.x2 !== undefined &&
      cmd.y2 !== undefined
    ) {
      cubic(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
    } else if (cmd.type === 'Z') {
      if (current.length >= 4) contours.push(current);
      current = [];
    }
  }
  if (current.length >= 4) contours.push(current);
  return contours;
}

function buildGeometry(positions: number[]): THREE.BufferGeometry | null {
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function GhostSurfaceText() {
  const { invalidate } = useThree();
  const params = useDesignerStore(useShallow((s) => s.params));
  const generationStatus = useDesignerStore((s) => s.generation.status);

  // Every face the walls actually reference, so the overlay never measures
  // against a face that has not arrived.
  const families = useMemo(() => {
    const out = new Set<string>();
    for (const side of WALL_TEXT_SIDES) {
      if ((params.surfaceText?.walls?.[side]?.trim() ?? '') === '') continue;
      const style = resolveTextStyle(
        params.textDefaults,
        params.surfaceText?.style,
        params.surfaceText?.wallStyles?.[side]
      );
      out.add(resolveEffectiveFont(style.font, style.mode));
    }
    return [...out];
  }, [params.surfaceText, params.textDefaults]);

  const measurer = useTypeMeasurer(families as Parameters<typeof useTypeMeasurer>[0]);

  const geometry = useMemo(
    () => (measurer ? buildWallTextOutline(params, measurer) : null),
    [params, measurer]
  );

  // Allocated only alongside geometry: a design with no wall text should cost
  // no GPU resource at all, and the overlay is absent far more often than not.
  const material = useMemo(
    () =>
      geometry
        ? new THREE.LineBasicMaterial({
            color: GHOST_COLOR,
            transparent: true,
            opacity: GHOST_OPACITY,
            depthTest: true,
          })
        : null,
    [geometry]
  );

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  // Shown while the mesh is being rebuilt, matching the other ghosts: once the
  // real geometry lands it is the better answer and the outline would only
  // double it.
  if (!geometry || !material || generationStatus !== 'generating') return null;
  return <lineSegments geometry={geometry} material={material} />;
}

/** Positions for every wall caption's outline, in preview world space. */
function buildWallTextOutline(
  params: ReturnType<typeof useDesignerStore.getState>['params'],
  measurer: TypeMeasurer
): THREE.BufferGeometry | null {
  const outerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * (params.gridUnitMmY ?? params.gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * params.wallThickness;
  const innerD = outerD - 2 * params.wallThickness;
  const totalH = params.height * params.heightUnitMm;
  const wallHeight = baseWallHeight(params.base, totalH);
  const floorZ = baseFloorZ(params.base, params.heightUnitMm, params.lid);

  const layouts = computeWallTextLayouts(
    params,
    {
      innerW,
      innerD,
      wallHeight,
      interiorHeight: computeInteriorHeight(
        wallHeight,
        params.base.stackingLip,
        GRIDFINITY.LIP_SMALL_TAPER
      ),
      solid: params.base.solid,
      isSlotted: params.style === 'slotted',
    },
    measurer
  );
  if (layouts.length === 0) return null;

  const positions: number[] = [];
  for (const layout of layouts) {
    const sign = wallTextReadingSign(layout.side);
    const yaw = (WALL_YAW[layout.side] * Math.PI) / 180;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const [tx, ty] = wallFaceTranslation(layout.side, innerW, innerD, params.wallThickness);
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
          // Emit as segments so one buffer covers every wall in one draw.
          for (let i = 0; i + 3 < contour.length; i += 2) {
            for (const [px, py] of [
              [contour[i], contour[i + 1]],
              [contour[i + 2], contour[i + 3]],
            ]) {
              positions.push(px * cos + tx, px * sin + ty, floorZ + py);
            }
          }
        }
      }
    }
  }
  return buildGeometry(positions);
}
