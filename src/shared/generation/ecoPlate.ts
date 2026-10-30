import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { computeCellBoundariesMm, decomposeCells, type CellInfo } from './cellDecomposition';

export interface EcoJointCutout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}

/** The untouched ends of each straight joint form solid corner posts. */
export function ecoJointCutouts(
  params: ResolvedBaseplateParams,
  marginCells: readonly CellInfo[] = []
): EcoJointCutout[] {
  const pitchX = params.gridUnitMm;
  const pitchY = params.gridUnitMmY ?? pitchX;
  const xCells = decomposeCells(params.width);
  const yCells = decomposeCells(params.depth);
  if (params.fractionalEdgeX === 'start') xCells.reverse();
  if (params.fractionalEdgeY === 'start') yCells.reverse();
  const xs = computeCellBoundariesMm(params.width, pitchX, params.fractionalEdgeX);
  const ys = computeCellBoundariesMm(params.depth, pitchY, params.fractionalEdgeY);
  // Split seams need the same relief as the inner grid. Connectors sit on
  // cell boundaries, outside these centered spans, so their mounting posts stay solid.
  if (params.paddingLeft === 0) xs.unshift((-params.width * pitchX) / 2);
  if (params.paddingRight === 0) xs.push((params.width * pitchX) / 2);
  if (params.paddingFront === 0) ys.unshift((-params.depth * pitchY) / 2);
  if (params.paddingBack === 0) ys.push((params.depth * pitchY) / 2);
  const cutouts: EcoJointCutout[] = [];
  const seen = new Map<string, number>();
  const jointWidth = Math.min(7, Math.min(pitchX, pitchY) * 0.17);
  const add = (slot: EcoJointCutout): void => {
    // Shared edges may be emitted by cells of different sizes. Keep one cutter
    // with the narrower width so a small clipped cell retains its corner post.
    const vertical = slot.width < slot.depth;
    const key = [vertical ? 'v' : 'h', slot.x, slot.y, vertical ? slot.depth : slot.width]
      .map((v) => (typeof v === 'number' ? v.toFixed(5) : v))
      .join(':');
    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      const existing = cutouts[existingIndex];
      if (vertical && slot.width < existing.width) cutouts[existingIndex] = slot;
      if (!vertical && slot.depth < existing.depth) cutouts[existingIndex] = slot;
      return;
    }
    seen.set(key, cutouts.length);
    cutouts.push(slot);
  };
  const widthFor = (size: number): number => Math.min(jointWidth, Math.max(2, size * 0.17));
  // Leave at least 2 mm between the rounded cut and the end of a small cell.
  const spanFor = (size: number, width: number): number => Math.min(size * 0.6, size - width - 4);
  let y = (-params.depth * pitchY) / 2;
  for (const units of yCells) {
    const size = units * pitchY;
    const width = widthFor(size);
    const span = spanFor(size, width);
    if (span >= 8) {
      for (const x of xs) {
        add({ x, y: y + size / 2, width, depth: span });
      }
    }
    y += size;
  }
  let x = (-params.width * pitchX) / 2;
  for (const units of xCells) {
    const size = units * pitchX;
    const width = widthFor(size);
    const span = spanFor(size, width);
    if (span >= 8) {
      for (const yBoundary of ys) {
        add({ x: x + size / 2, y: yBoundary, width: span, depth: width });
      }
    }
    x += size;
  }
  // Use the exact margin cells that the pocket builder cut. Their clipped and
  // half-grid sizes determine where the frame walls really are.
  for (const cell of marginCells) {
    const halfW = (cell.widthUnits * pitchX) / 2;
    const halfD = (cell.depthUnits * pitchY) / 2;
    const marginWidth = widthFor(Math.min(halfW * 2, halfD * 2));
    const verticalSpan = spanFor(halfD * 2, marginWidth);
    const horizontalSpan = spanFor(halfW * 2, marginWidth);
    if (verticalSpan >= 8) {
      add({ x: cell.centerX - halfW, y: cell.centerY, width: marginWidth, depth: verticalSpan });
      add({ x: cell.centerX + halfW, y: cell.centerY, width: marginWidth, depth: verticalSpan });
    }
    if (horizontalSpan >= 8) {
      add({ x: cell.centerX, y: cell.centerY - halfD, width: horizontalSpan, depth: marginWidth });
      add({ x: cell.centerX, y: cell.centerY + halfD, width: horizontalSpan, depth: marginWidth });
    }
  }
  return cutouts;
}
