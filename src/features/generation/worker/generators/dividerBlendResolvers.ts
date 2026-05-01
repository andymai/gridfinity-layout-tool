/**
 * Pure resolvers that derive the divider/cutout geometry inputs the
 * blend builder needs from the user's `BinParams`.
 *
 * Functions here perform pure JS computation — they don't call brepjs
 * directly. (The transitive import of `findWallSegments` from
 * `compartmentBuilder` does load the brepjs module at evaluation time;
 * the data-only property is on the call paths, not the dep graph.)
 * Reused by the wall-pattern builder via `computeRampZones` and
 * `computeDividerJunctionZones`.
 */

import type { BinParams } from '@/shared/types/bin';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { findWallSegments } from './compartmentBuilder';
import type { DividerInfo, OuterWallCutoutInfo } from './dividerBlendTypes';

/**
 * Resolve outer-wall cutout geometry for all enabled sides.
 * Pure function — no brepjs dependency.
 */
export function resolveOuterCutouts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): OuterWallCutoutInfo[] {
  if (!params.walls.enabled) return [];

  const interiorHeight = wallHeight - params.wallThickness;
  const result: OuterWallCutoutInfo[] = [];

  const sides: Array<{
    key: 'front' | 'back' | 'left' | 'right';
    wallSpan: number;
    wallFaceCoord: number;
    inwardSign: number;
    spanAxis: 'x' | 'y';
  }> = [
    { key: 'front', wallSpan: innerW, wallFaceCoord: -innerD / 2, inwardSign: 1, spanAxis: 'x' },
    { key: 'back', wallSpan: innerW, wallFaceCoord: innerD / 2, inwardSign: -1, spanAxis: 'x' },
    { key: 'left', wallSpan: innerD, wallFaceCoord: -innerW / 2, inwardSign: 1, spanAxis: 'y' },
    { key: 'right', wallSpan: innerD, wallFaceCoord: innerW / 2, inwardSign: -1, spanAxis: 'y' },
  ];

  for (const side of sides) {
    const cfg = params.walls[side.key];
    if (!cfg.enabled) continue;

    const cutWidth =
      cfg.widthMm !== null
        ? Math.min(cfg.widthMm, side.wallSpan)
        : side.wallSpan * (cfg.width / 100);

    const userCutHeight = interiorHeight * (cfg.depth / 100);
    if (cutWidth < 0.1 || userCutHeight < 0.1) continue;

    const centerOffset = computeCutoutCenter(
      side.wallSpan,
      cutWidth,
      params.wallThickness,
      cfg.alignment,
      cfg.offset
    );

    result.push({
      side: side.key,
      wallSpan: side.wallSpan,
      cutWidth,
      userCutHeight,
      cutBottom: wallHeight - userCutHeight,
      centerOffset,
      cutLeft: centerOffset - cutWidth / 2,
      cutRight: centerOffset + cutWidth / 2,
      wallFaceCoord: side.wallFaceCoord,
      inwardSign: side.inwardSign,
      spanAxis: side.spanAxis,
    });
  }

  return result;
}

/**
 * Collect divider wall segments from the compartment grid.
 * Pure function — mirrors compartmentBuilder logic.
 */
export function collectDividers(params: BinParams, innerW: number, innerD: number): DividerInfo[] {
  const { cols, rows, thickness, cells } = params.compartments;
  if (cols <= 1 && rows <= 1) return [];
  if (new Set(cells).size <= 1) return [];

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Mirror buildCompartmentWalls small-cell guard:
  // skip axes where cells are too narrow for viable divider geometry.
  const effectiveCellW = (innerW - (cols - 1) * thickness) / cols;
  const effectiveCellD = (innerD - (rows - 1) * thickness) / rows;
  const canBuildVertical = effectiveCellW >= thickness * 2;
  const canBuildHorizontal = effectiveCellD >= thickness * 2;

  const dividers: DividerInfo[] = [];

  // Vertical dividers (between columns, run along Y)
  if (canBuildVertical)
    for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
      const xPos = -innerW / 2 + colBoundary * cellW;
      const segments = findWallSegments(rows, (row) => {
        const leftId = cells[row * cols + (colBoundary - 1)];
        const rightId = cells[row * cols + colBoundary];
        return leftId !== rightId;
      });
      for (const [start, end] of segments) {
        dividers.push({
          axis: 'vertical',
          posAlongPerp: xPos,
          spanStart: -innerD / 2 + start * cellD,
          spanEnd: -innerD / 2 + end * cellD,
          thickness,
        });
      }
    }

  // Horizontal dividers (between rows, run along X)
  if (canBuildHorizontal)
    for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
      const yPos = -innerD / 2 + rowBoundary * cellD;
      const segments = findWallSegments(cols, (col) => {
        const topId = cells[(rowBoundary - 1) * cols + col];
        const bottomId = cells[rowBoundary * cols + col];
        return topId !== bottomId;
      });
      for (const [start, end] of segments) {
        dividers.push({
          axis: 'horizontal',
          posAlongPerp: yPos,
          spanStart: -innerW / 2 + start * cellW,
          spanEnd: -innerW / 2 + end * cellW,
          thickness,
        });
      }
    }

  return dividers;
}
