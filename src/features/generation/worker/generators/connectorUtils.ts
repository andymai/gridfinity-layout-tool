/**
 * Legacy connector position computation for the direct mesh baseplate generator.
 *
 * Computes nub/hole positions along the seam edges of split baseplate pieces:
 * the join edges, plus every padding-free exterior edge once all-edge slots are
 * enabled (#2866). Only used by baseplateDirectMesh.ts — the BREP generator uses
 * dovetail connectors from splitConnectorBuilder.ts instead.
 *
 * The markers are a style-agnostic cylindrical stand-in for whichever connector
 * profile the exact build cuts; only WHICH edges carry one has to agree with
 * `buildConnectors`, since the draft can stay on screen if BREP fails.
 */
import type { BaseplateEdges } from '@/shared/types/bin';
import { edgeCarriesSlot } from '@/shared/types/bin';
import { computeCellBoundariesMm } from './cellDecomposition';

/** Per-side drawer-fit padding (mm) — decides all-edge slot eligibility. */
export interface SidePaddingMm {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

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
  edges: BaseplateEdges,
  invertDovetails?: boolean,
  fractionalEdgeX: 'start' | 'end' = 'end',
  fractionalEdgeY: 'start' | 'end' = 'end',
  // Depth-axis pitch for a non-square grid; defaults to the square pitch.
  gridUnitMmY: number = gridUnitMm,
  // All-edge slots (#2866): padding-free exterior edges carry a female slot too.
  // `padding` gates that per side, exactly as in `buildConnectors`.
  allEdgeSlots: boolean = false,
  padding: SidePaddingMm = { left: 0, right: 0, front: 0, back: 0 },
  // Both-female styles (dovetail key / snap clip): the exact build puts a female
  // half on BOTH sides of every seam, so no marker is male whatever the invert
  // convention would otherwise say.
  femaleSeams: boolean = false
): ConnectorPos[] {
  const positions: ConnectorPos[] = [];
  const zCenter = totalHeight / 2;
  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const invert = !!invertDovetails;

  // Honors fractionalEdgeX/Y so dovetails land on cell boundaries even when
  // the half-cell is at the start (rotated piece under preferIdenticalPieces).
  const yBoundaries = computeCellBoundariesMm(depth, gridUnitMmY, fractionalEdgeY);
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
    if (boundaries.length === 0) continue;
    if (!edgeCarriesSlot(edges[side], allEdgeSlots, padding[side])) continue;
    // The invert convention only applies to the integral styles that actually
    // have a male half; a both-female seam is female on both sides. Exterior
    // slots are female by construction (the option is both-female only).
    const male = !femaleSeams && edges[side] === 'join' && isMale;
    for (const bp of boundaries) {
      const { cx, cy } = position(bp);
      positions.push({ cx, cy, cz: zCenter, nx, ny, isMale: male });
    }
  }

  return positions;
}
