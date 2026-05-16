/**
 * Connector position computation for the direct mesh baseplate generator.
 *
 * One connector per cell along each join edge — matching upstream
 * `cutter_screw_together`'s "fastener per cell" pattern. The previous
 * boundary-indexed math placed connectors at internal cell boundaries,
 * leaving 1×1 splits with zero connectors and corner cells unsupported.
 */
import { cellCentersAlong } from './cellDecomposition';

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

  const yCenters = cellCentersAlong(depth, gridUnitMm, fractionalEdgeY);
  const xCenters = cellCentersAlong(width, gridUnitMm, fractionalEdgeX);

  const edgeDefs: ReadonlyArray<{
    side: keyof typeof edges;
    centers: readonly number[];
    position: (c: number) => { cx: number; cy: number };
    nx: number;
    ny: number;
    isMale: boolean;
  }> = [
    {
      side: 'left',
      centers: yCenters,
      position: (cy) => ({ cx: -halfW + slabOffsetX, cy }),
      nx: -1,
      ny: 0,
      isMale: !invert,
    },
    {
      side: 'right',
      centers: yCenters,
      position: (cy) => ({ cx: halfW + slabOffsetX, cy }),
      nx: 1,
      ny: 0,
      isMale: invert,
    },
    {
      side: 'front',
      centers: xCenters,
      position: (cx) => ({ cx, cy: -halfD + slabOffsetY }),
      nx: 0,
      ny: -1,
      isMale: !invert,
    },
    {
      side: 'back',
      centers: xCenters,
      position: (cx) => ({ cx, cy: halfD + slabOffsetY }),
      nx: 0,
      ny: 1,
      isMale: invert,
    },
  ];

  for (const { side, centers, position, nx, ny, isMale } of edgeDefs) {
    if (edges[side] !== 'join') continue;
    for (const c of centers) {
      const { cx, cy } = position(c);
      positions.push({ cx, cy, cz: zCenter, nx, ny, isMale });
    }
  }

  return positions;
}
