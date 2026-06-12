// @vitest-environment node
/**
 * A split baseplate's integral dovetail tongues must not poke into the bin
 * sockets of the neighbouring piece across the seam.
 *
 * The gridfinity socket mouth opens to the full cell at the slab top
 * (`INSET_TOP = 0`). In "prefer identical pieces" (paired) mode the tongue is
 * offset `PAIR_HALF_OFFSET` (4 mm — exactly the socket corner radius) off the
 * cell-boundary junction, landing on the fully-open straight edge of the socket
 * mouth. Un-relieved, each tongue drove ~2.4 mm³ of solid straight into where
 * the neighbour's bin foot seats, so bins next to a seam wouldn't sit flush
 * (user report: "dovetails do not follow the shape of the grid … I cut those
 * small pieces with a knife"). `buildConnectors` now subtracts the neighbouring
 * sockets from each tongue, mirroring `relieveClipForSockets` for the snap clip.
 *
 * The fix is verified by intersecting the fused tongues with the actual
 * neighbour bin feet (cell − CLEARANCE) and requiring ~zero overlap, while the
 * tongues keep enough material to still lock the joint.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect } from 'brepjs';
import { isOk } from '@/core/result';
import type { BaseplateParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildConnectors } from './baseplateConnectors';
import { buildSingleCellSocket } from './socketBuilder';
import { decomposeCells } from './cellDecomposition';
import { SOCKET_HEIGHT, MAGNET_FLOOR, CLEARANCE } from './generatorConstants';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const defaults = (o: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 1,
  depth: 3,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  connectorNubs: true,
  // A left join edge → tongues protrude across the seam (−x) into the neighbour.
  edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
  ...o,
});

/**
 * Total overlap volume between the fused tongues and the neighbouring piece's
 * bin feet across a left-hand seam. The neighbour column sits one grid unit
 * beyond the seam wall (−totalW/2 − GU/2); its feet are placed at the real
 * cell-decomposition centres (so this holds for fractional depths too) and each
 * foot is sized to its cell (cell − CLEARANCE).
 */
function tongueFootOverlap(params: BaseplateParams): { overlap: number; tongueVol: number } {
  const GU = params.gridUnitMm;
  const totalHeight = SOCKET_HEIGHT + (params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0);
  const totalW = params.width * GU;
  const totalD = params.depth * GU;
  const { nubs } = buildConnectors(params, totalHeight, totalW, totalD, 0, 0);
  try {
    const tongueVol = nubs.reduce((sum, n) => sum + vol(n), 0);
    const nx = -totalW / 2 - GU / 2;
    let overlap = 0;
    let pos = 0;
    for (const u of decomposeCells(params.depth)) {
      const sizeMm = u * GU;
      const cy = pos + sizeMm / 2 - totalD / 2;
      pos += sizeMm;
      const socket = buildSingleCellSocket(GU - CLEARANCE, sizeMm - CLEARANCE);
      const foot = translate(socket, [nx, cy, 0]);
      socket.delete(); // translate returns a new shape; free the pre-translate one
      for (const tongue of nubs) {
        const i = intersect(tongue, foot);
        if (isOk(i)) {
          overlap += vol(i.value);
          i.value.delete();
        }
      }
      foot.delete();
    }
    return { overlap, tongueVol };
  } finally {
    for (const n of nubs) n.delete();
  }
}

describe('integral dovetail tongue vs neighbour edge-socket interference', () => {
  it('paired-mode tongues do not intrude into the neighbour bin feet', () => {
    const { overlap, tongueVol } = tongueFootOverlap(defaults({ preferIdenticalPieces: true }));
    // Un-relieved paired tongues overlapped the feet by ~4.9 mm³ (2 tongues).
    expect(overlap, 'tongue ∩ neighbour feet').toBeLessThan(0.02);
    // …while keeping enough material to still lock the joint (was ~34.7 mm³).
    expect(tongueVol, 'tongues retain locking material').toBeGreaterThan(12);
  }, 60_000);

  it('plain junction-centred tongues also clear the neighbour bin feet', () => {
    const { overlap } = tongueFootOverlap(defaults());
    expect(overlap, 'tongue ∩ neighbour feet').toBeLessThan(0.02);
  }, 60_000);

  it('magnet-plate paired tongues clear the neighbour bin feet', () => {
    const { overlap } = tongueFootOverlap(
      defaults({ magnetHoles: true, preferIdenticalPieces: true })
    );
    expect(overlap, 'tongue ∩ neighbour feet').toBeLessThan(0.02);
  }, 60_000);
});
