// @vitest-environment node
/**
 * Split connectors on a tapered overhang wall.
 *
 * A tapered side is full-width at the rim and angles inward over the band, so
 * below the band top its outer face stands `taperInsetAt` inboard of the rim
 * edge. Connectors placed off the rim edge alone hang in the air beside that
 * wall: the male piece grows a key, a pilaster and a floor scarf where there
 * is no wall to carry them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { WallTaperProfile } from '@/core/types';
import type { MeshData } from '@/features/generation/bridge/types';
import {
  initBrepjs,
  getExportSplitBin,
  getGenerateSplitPreview,
} from './__kernel-tests__/wasmInit';
import { analyze as analyzeExportedStl } from './__kernel-tests__/exportIntegrityRunner';
import { assertStructurallyValid, isSolidThrough } from './__kernel-tests__/meshAssertions';
import { deriveDimensions } from './pipeline/context';
import { resolveOverhang, taperInsetAt } from './overhang';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const KEYS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: true,
  wallConnector: 'key',
};

const LEFT_OVERHANG = 24;
const LEFT_TAPER = 15;

const paramsFor = (profile: WallTaperProfile): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 1,
  depth: 4,
  height: 7,
  // As reported. A lip's support skirt runs at rim width below the rim on the
  // unsplit bin too, which is the lip's concern, not the connectors'.
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
  overhang: {
    left: LEFT_OVERHANG,
    right: 0,
    front: 0,
    back: 0,
    feet: false,
    enabled: true,
    taper: {
      enabled: true,
      profile,
      bandHeight: 44,
      left: LEFT_TAPER,
      right: 0,
      front: 0,
      back: 0,
    },
  },
});

// Half-height of a vertical probe. A slanted face moves across a taller one, so
// the probe would read the face's own lean as missing material.
const PROBE = 0.05;

describe.each<WallTaperProfile>(['chamfer', 'fillet'])(
  'split connectors follow a %s-tapered overhang wall',
  (profile) => {
    const PARAMS = paramsFor(profile);
    const dim = deriveDimensions(PARAMS, true);
    const taper = resolveOverhang(PARAMS.overhang).taper;
    const outerW = PARAMS.width * PARAMS.gridUnitMm - 0.5;
    const leftRim = -outerW / 2 - LEFT_OVERHANG;
    // tessellatePiece re-centres each piece on its own span: a single-column
    // piece spans the overhang-inclusive width, and the front piece runs from
    // the front edge to the cut at y = 0.
    const pieceCenterX = (0 - LEFT_OVERHANG) / 2;
    const pieceCenterY = -(PARAMS.depth * PARAMS.gridUnitMm - 0.5) / 4;
    const wallHeight = dim.wallTopZ - dim.baseOffsetZ;
    const wallFaceAt = (z: number): number => {
      if (!taper) throw new Error('expected a resolved taper');
      return leftRim + taperInsetAt(taper, LEFT_TAPER, z - dim.baseOffsetZ, wallHeight);
    };

    type SplitPiece = ReturnType<ReturnType<typeof getGenerateSplitPreview>>['pieces'][number];
    let pieces: readonly SplitPiece[] = [];
    let male: SplitPiece;
    let female: SplitPiece;
    beforeAll(() => {
      pieces = getGenerateSplitPreview()(PARAMS, [], [0], KEYS).pieces;
      // Row 0 (front, −Y) carries the male connectors across the cut at y = 0.
      male = pieces.reduce((a, b) => (b.offsetY < a.offsetY ? b : a));
      female = pieces.reduce((a, b) => (b.offsetY > a.offsetY ? b : a));
    }, 120000);

    function* vertices(): Generator<[number, number, number]> {
      const v = male.vertices;
      for (let i = 0; i < v.length; i += 3) {
        yield [v[i] + pieceCenterX, v[i + 1] + pieceCenterY, v[i + 2]];
      }
    }

    it('grows no material outside the tapered wall', () => {
      expect(pieces).toHaveLength(2);
      let worst = 0;
      let worstAt: [number, number, number] | null = null;
      for (const [x, y, z] of vertices()) {
        if (z < dim.baseOffsetZ) continue;
        const outside = wallFaceAt(z) - x;
        if (outside > worst) {
          worst = outside;
          worstAt = [x, y, z];
        }
      }
      expect(
        worst,
        `vertex ${worst.toFixed(2)}mm outside the wall at ${JSON.stringify(worstAt?.map((n) => +n.toFixed(2)))}`
      ).toBeLessThanOrEqual(0.05);
    }, 120000);

    // Probed where the wall stands well inboard of the rim, a key's width in from
    // its face and a millimetre past the cut, so only the tongue can be there.
    it('still keys the tapered wall inside the band', () => {
      const z = dim.baseOffsetZ + (taper?.bandHeight ?? 0) / 3;
      const tongueX = wallFaceAt(z) + 1.75;
      const mesh: MeshData = { ...male, triangleCount: male.indices.length / 3 };
      expect(
        isSolidThrough(mesh, tongueX - pieceCenterX, 1 - pieceCenterY, z - PROBE, z + PROBE)
      ).toBe(true);
    }, 120000);

    // The groove sits between the wall's outer skin and the pilaster behind it;
    // all three have to follow the wall for the tongue to seat.
    it('cuts the mating groove into the tapered wall', () => {
      const z = dim.baseOffsetZ + (taper?.bandHeight ?? 0) / 3;
      const mesh: MeshData = { ...female, triangleCount: female.indices.length / 3 };
      const solidAt = (inboard: number): boolean =>
        isSolidThrough(
          mesh,
          wallFaceAt(z) + inboard - pieceCenterX,
          1 + pieceCenterY,
          z - PROBE,
          z + PROBE
        );
      expect(solidAt(0.4)).toBe(true);
      expect(solidAt(1.75)).toBe(false);
      expect(solidAt(2.95)).toBe(true);
    }, 120000);

    // Just under the floor top, where the male lap overhangs the cut and the
    // female floor is ramped away to receive it, centred on the floor's own span.
    it('laps the floor across the cut at the narrowed floor centre', () => {
      const z = dim.baseOffsetZ + PARAMS.wallThickness * 0.6;
      const floorCentreLocalX = LEFT_TAPER / 2;
      const at = (piece: SplitPiece, worldY: number, centreY: number): boolean =>
        isSolidThrough(
          { ...piece, triangleCount: piece.indices.length / 3 },
          floorCentreLocalX,
          worldY - centreY,
          z - PROBE,
          z + PROBE
        );
      expect(at(male, 0.3, pieceCenterY)).toBe(true);
      expect(at(female, 0.3, -pieceCenterY)).toBe(false);
      expect(at(female, 1.5, -pieceCenterY)).toBe(true);
    }, 120000);

    it('builds valid pieces that export watertight', async () => {
      for (const [i, piece] of pieces.entries()) {
        assertStructurallyValid(
          { ...piece, triangleCount: piece.indices.length / 3 },
          `${profile} preview piece ${i}`
        );
      }
      const exported = await getExportSplitBin()(PARAMS, [], [0], 0.01, 5, KEYS);
      expect(exported.pieces).toHaveLength(2);
      for (const [i, piece] of exported.pieces.entries()) {
        const label = `${profile} export piece ${i}`;
        const stats = analyzeExportedStl(piece.data, label);
        expect(stats.minFinite, `${label}: finite coordinates`).toBe(true);
        expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
        expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
        expect(stats.volume, `${label}: volume`).toBeGreaterThan(0);
      }
    }, 240000);
  }
);
