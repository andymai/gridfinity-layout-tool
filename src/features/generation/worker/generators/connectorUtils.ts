/**
 * Legacy connector position computation for the direct mesh baseplate generator.
 *
 * Computes nub/hole positions along join edges of split baseplate pieces.
 * Only used by baseplateDirectMesh.ts — the BREP generator uses dovetail
 * connectors from splitConnectorBuilder.ts instead.
 */

// ─── Legacy Connector Position Computation ───────────────────────────────────

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
  edges: { left: string; right: string; front: string; back: string }
): ConnectorPos[] {
  const positions: ConnectorPos[] = [];
  const zCenter = totalHeight / 2;
  const halfW = totalW / 2;
  const halfD = totalD / 2;

  const edgeDefs: ReadonlyArray<{
    side: keyof typeof edges;
    numBoundaries: number;
    position: (k: number) => { cx: number; cy: number };
    nx: number;
    ny: number;
    isMale: boolean;
  }> = [
    {
      side: 'left',
      numBoundaries: Math.ceil(depth) - 1,
      position: (k) => ({
        cx: -halfW + slabOffsetX,
        cy: k * gridUnitMm - (depth * gridUnitMm) / 2,
      }),
      nx: -1,
      ny: 0,
      isMale: true,
    },
    {
      side: 'right',
      numBoundaries: Math.ceil(depth) - 1,
      position: (k) => ({
        cx: halfW + slabOffsetX,
        cy: k * gridUnitMm - (depth * gridUnitMm) / 2,
      }),
      nx: 1,
      ny: 0,
      isMale: false,
    },
    {
      side: 'front',
      numBoundaries: Math.ceil(width) - 1,
      position: (k) => ({
        cx: k * gridUnitMm - (width * gridUnitMm) / 2,
        cy: -halfD + slabOffsetY,
      }),
      nx: 0,
      ny: -1,
      isMale: true,
    },
    {
      side: 'back',
      numBoundaries: Math.ceil(width) - 1,
      position: (k) => ({
        cx: k * gridUnitMm - (width * gridUnitMm) / 2,
        cy: halfD + slabOffsetY,
      }),
      nx: 0,
      ny: 1,
      isMale: false,
    },
  ];

  for (const { side, numBoundaries, position, nx, ny, isMale } of edgeDefs) {
    if (edges[side] !== 'join' || numBoundaries <= 0) continue;
    for (let k = 1; k <= numBoundaries; k++) {
      const { cx, cy } = position(k);
      positions.push({ cx, cy, cz: zCenter, nx, ny, isMale });
    }
  }

  return positions;
}
