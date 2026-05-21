/**
 * Legacy connector position computation for the direct mesh baseplate generator.
 *
 * Computes nub/hole positions along join edges of split baseplate pieces.
 * Only used by baseplateDirectMesh.ts — the BREP generator uses dovetail
 * connectors from splitConnectorBuilder.ts instead.
 */
import { computeCellBoundariesMm } from './cellDecomposition';

export interface ConnectorPos {
  cx: number;
  cy: number;
  cz: number;
  nx: number;
  ny: number;
  isMale: boolean;
}

export function computeConnectorPositions(
  width: number,
  depth: number,
  gridUnitMm: number,
  totalHeight: number,
  totalW: number,
  totalD: number,
  slabOffsetX: number,
  slabOffsetY: number,
  edges: { left: string; right: string; front: string; back: string },
  invertDovetails?: boolean,
  fractionalEdgeX: 'start' | 'end' = 'end',
  fractionalEdgeY: 'start' | 'end' = 'end'
): ConnectorPos[] {
  const positions: ConnectorPos[] = [];
  const zCenter = totalHeight / 2;
  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const invert = !!invertDovetails;

  // Honors fractionalEdgeX/Y so dovetails land on cell boundaries even when
  // the half-cell is at the start (rotated piece under preferIdenticalPieces).
  const yBoundaries = computeCellBoundariesMm(depth, gridUnitMm, fractionalEdgeY);
  const xBoundaries = computeCellBoundariesMm(width, gridUnitMm, fractionalEdgeX);

  const edgeDefs: ReadonlyArray<{
    side: keyof typeof edges;
    boundaries: readonly number[];
    position: (bp: number) => { cx: number; cy: number };
    nx: number;
    ny: number;
    isMale: boolean;
  }> = [
    {
      side: 'left',
      boundaries: yBoundaries,
      position: (bp) => ({ cx: -halfW + slabOffsetX, cy: bp }),
      nx: -1,
      ny: 0,
      isMale: !invert,
    },
    {
      side: 'right',
      boundaries: yBoundaries,
      position: (bp) => ({ cx: halfW + slabOffsetX, cy: bp }),
      nx: 1,
      ny: 0,
      isMale: invert,
    },
    {
      side: 'front',
      boundaries: xBoundaries,
      position: (bp) => ({ cx: bp, cy: -halfD + slabOffsetY }),
      nx: 0,
      ny: -1,
      isMale: !invert,
    },
    {
      side: 'back',
      boundaries: xBoundaries,
      position: (bp) => ({ cx: bp, cy: halfD + slabOffsetY }),
      nx: 0,
      ny: 1,
      isMale: invert,
    },
  ];

  for (const { side, boundaries, position, nx, ny, isMale } of edgeDefs) {
    if (edges[side] !== 'join' || boundaries.length === 0) continue;
    for (const bp of boundaries) {
      const { cx, cy } = position(bp);
      positions.push({ cx, cy, cz: zCenter, nx, ny, isMale });
    }
  }

  return positions;
}
