import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { computeCellBoundariesMm, decomposeCells, type CellInfo } from './cellDecomposition';

export interface EcoJointCutout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}

const ECO_MIN_FRAME_STRIP_MM = 2;

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
  // Split seams and the outer cell edges need the same relief as the inner grid.
  // Connectors sit on cell boundaries, outside these centered spans, so their
  // mounting posts stay solid.
  const xs = withOuterEdges(
    computeCellBoundariesMm(params.width, pitchX, params.fractionalEdgeX),
    (params.width * pitchX) / 2,
    params.paddingLeft,
    params.paddingRight
  );
  const ys = withOuterEdges(
    computeCellBoundariesMm(params.depth, pitchY, params.fractionalEdgeY),
    (params.depth * pitchY) / 2,
    params.paddingFront,
    params.paddingBack
  );
  const cutouts: EcoJointCutout[] = [];
  const seen = new Map<string, number>();
  const jointWidth = Math.min(7, Math.min(pitchX, pitchY) * 0.17);
  const add = (slot: EcoJointCutout, vertical: boolean): void => {
    // Shared edges may be emitted by cells of different sizes. Keep one cutter
    // with the narrower width so a small clipped cell retains its corner post.
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
      for (const boundary of xs) {
        const across = reliefAcross(boundary, width);
        add({ x: across.center, y: y + size / 2, width: across.size, depth: span }, true);
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
      for (const boundary of ys) {
        const across = reliefAcross(boundary, width);
        add({ x: x + size / 2, y: across.center, width: span, depth: across.size }, false);
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
      for (const edgeX of [cell.centerX - halfW, cell.centerX + halfW]) {
        add({ x: edgeX, y: cell.centerY, width: marginWidth, depth: verticalSpan }, true);
      }
    }
    if (horizontalSpan >= 8) {
      for (const edgeY of [cell.centerY - halfD, cell.centerY + halfD]) {
        add({ x: cell.centerX, y: edgeY, width: horizontalSpan, depth: marginWidth }, false);
      }
    }
  }
  return cutouts;
}

interface ReliefBoundary {
  readonly at: number;
  /** Solid padding beyond an outer grid edge; 0 for an inner boundary. */
  readonly padding: number;
  /** Which way the padding lies: -1 below, 1 above, 0 for an inner boundary. */
  readonly outward: -1 | 0 | 1;
}

function withOuterEdges(
  inner: readonly number[],
  halfExtent: number,
  lowPadding: number,
  highPadding: number
): ReliefBoundary[] {
  return [
    { at: -halfExtent, padding: lowPadding, outward: -1 },
    ...inner.map((at): ReliefBoundary => ({ at, padding: 0, outward: 0 })),
    { at: halfExtent, padding: highPadding, outward: 1 },
  ];
}

/**
 * Centered like an inner joint where the padding can keep a free-standing strip
 * beside the channel. A narrower strip would print as a fragile sliver, so the
 * channel runs out through the plate edge instead, as on an unpadded side.
 */
function reliefAcross(boundary: ReliefBoundary, width: number): { center: number; size: number } {
  const grow = boundary.padding < width / 2 + ECO_MIN_FRAME_STRIP_MM ? boundary.padding : 0;
  return { center: boundary.at + (boundary.outward * grow) / 2, size: width + grow };
}
