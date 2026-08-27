import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout, KnifeSpec } from '@/features/bin-designer/types';
import {
  DEFAULT_KNIFE_SPEC,
  KNIFE_SLOT_EDGE_FLOAT,
  knifeBlockTopZMm,
  knifeRestSaddleZMm,
} from '@/features/bin-designer/types';
import {
  knifeGhostProfile,
  knifeGhostPoses,
  buildKnifeGhostPositions,
  GHOST_HANDLE_LENGTH_MM,
} from './knifeGhostGeometry';

const CHEF: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
  openEnd: 'end',
};

const SLOT_WIDTH = 215;

function knifeSlot(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'k1',
    shape: 'knifeSlot',
    x: 20,
    y: 16,
    width: SLOT_WIDTH,
    depth: 3.8,
    cutDepth: CHEF.heelHeightMm + KNIFE_SLOT_EDGE_FLOAT,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    knife: CHEF,
    ...overrides,
  };
}

function block(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 6,
    depth: 1,
    height: 8,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [knifeSlot()],
    knifeRest: { enabled: true },
    ...overrides,
  };
}

/** The interior the slot's own x/y are measured from, restated independently. */
function interior(params: BinParams): { innerW: number; innerD: number } {
  const unitY = params.gridUnitMmY ?? params.gridUnitMm;
  return {
    innerW: params.width * params.gridUnitMm - 0.5 - 2 * params.wallThickness,
    innerD: params.depth * unitY - 0.5 - 2 * params.wallThickness,
  };
}

describe('knifeGhostProfile', () => {
  it('hangs the handle so its underside is the rest saddle', () => {
    // The saddle is the one height the block, the rest's groove and this ghost
    // all have to agree on — a handle drawn anywhere else shows a knife the
    // generated groove would not carry.
    const { handle } = knifeGhostProfile(CHEF);
    const spineZ = 56;
    const lowest = Math.min(...handle.map(([, belowSpine]) => belowSpine));
    expect(spineZ + lowest).toBeCloseTo(knifeRestSaddleZMm(spineZ, CHEF), 6);
  });

  it('lies the spine flush and drops exactly the heel height at the heel', () => {
    const { blade } = knifeGhostProfile(CHEF);
    expect(Math.max(...blade.map(([, belowSpine]) => belowSpine))).toBe(0);
    expect(Math.min(...blade.map(([, belowSpine]) => belowSpine))).toBeCloseTo(
      -CHEF.heelHeightMm,
      6
    );
  });

  it('puts the whole blade behind the heel and the whole handle past it', () => {
    const { blade, handle } = knifeGhostProfile(CHEF);
    expect(Math.max(...blade.map(([along]) => along))).toBe(0);
    expect(Math.min(...blade.map(([along]) => along))).toBeCloseTo(-CHEF.bladeLengthMm, 6);
    expect(Math.min(...handle.map(([along]) => along))).toBe(0);
    expect(Math.max(...handle.map(([along]) => along))).toBeCloseTo(GHOST_HANDLE_LENGTH_MM, 6);
  });

  it('closes the handle butt at the handle diameter, not wider', () => {
    const { handle } = knifeGhostProfile(CHEF);
    const heights = handle.map(([, belowSpine]) => belowSpine);
    expect(Math.max(...heights) - Math.min(...heights)).toBeCloseTo(CHEF.handleHeightMm, 6);
  });
});

describe('knifeGhostPoses', () => {
  it('hangs the knife off the slot open edge, tip clear of the closed end', () => {
    const params = block();
    const poses = knifeGhostPoses(params);
    expect(poses).toHaveLength(1);
    const { innerW } = interior(params);
    // Slot spans [x, x + width] from the interior's left edge; the heel is its
    // open (+X) end, so the tip lands one slot margin inside the closed end.
    expect(poses[0].heelX).toBeCloseTo(20 + SLOT_WIDTH - innerW / 2, 6);
    expect(poses[0].outX).toBe(1);
    expect(poses[0].outY).toBe(0);
    const tipX = poses[0].heelX - CHEF.bladeLengthMm;
    expect(tipX - (20 - innerW / 2)).toBeCloseTo(SLOT_WIDTH - CHEF.bladeLengthMm, 6);
  });

  it('lies the spine on the block fill top', () => {
    const params = block();
    expect(knifeGhostPoses(params)[0].spineZ).toBe(knifeBlockTopZMm(params));
  });

  it('floats the edge above the slot floor by the slot design float', () => {
    // Spine flush plus a slot cut one float deeper than the heel is exactly
    // what keeps the edge off the plastic.
    const params = block();
    const pose = knifeGhostPoses(params)[0];
    const slotFloorZ = pose.spineZ - (CHEF.heelHeightMm + KNIFE_SLOT_EDGE_FLOAT);
    const edgeZ = pose.spineZ - CHEF.heelHeightMm;
    expect(edgeZ - slotFloorZ).toBeCloseTo(KNIFE_SLOT_EDGE_FLOAT, 6);
  });

  it('leaves through the other end when the spec opens at the start', () => {
    const params = block({ cutouts: [knifeSlot({ knife: { ...CHEF, openEnd: 'start' } })] });
    const pose = knifeGhostPoses(params)[0];
    const { innerW } = interior(params);
    expect(pose.outX).toBe(-1);
    expect(pose.heelX).toBeCloseTo(20 - innerW / 2, 6);
  });

  it('turns with the slot, exactly onto an axis', () => {
    // Local +X sweeps right → front → left → back, matching the wall the exit
    // plan names. A trig round-off here would tilt the whole knife.
    const cases: readonly [number, number, number][] = [
      [0, 1, 0],
      [90, 0, -1],
      [180, -1, 0],
      [270, 0, 1],
    ];
    for (const [rotation, outX, outY] of cases) {
      const pose = knifeGhostPoses(
        block({ width: 6, depth: 6, cutouts: [knifeSlot({ rotation })] })
      )[0];
      expect(pose.outX).toBe(outX);
      expect(pose.outY).toBe(outY);
    }
  });

  it('poses every instance of an array', () => {
    const params = block({
      cutouts: [
        knifeSlot({
          array: {
            mode: 'grid',
            cols: 1,
            rows: 3,
            pitchX: 0,
            pitchY: 10,
            count: 1,
            radius: 0,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
      ],
    });
    const poses = knifeGhostPoses(params);
    expect(poses).toHaveLength(3);
    expect(new Set(poses.map((p) => p.heelY)).size).toBe(3);
  });

  it('falls back to the default knife when the spec was stripped', () => {
    const params = block({ cutouts: [knifeSlot({ knife: undefined })] });
    expect(knifeGhostPoses(params)[0].knife).toEqual(DEFAULT_KNIFE_SPEC);
  });

  it('poses nothing for a slot that never opens through a wall', () => {
    const params = block({ cutouts: [knifeSlot({ knife: { ...CHEF, openEnd: undefined } })] });
    expect(knifeGhostPoses(params)).toEqual([]);
  });

  it('skips the slots the wall breach itself skips', () => {
    // Same gates as `knifeSlotWallExits`: a knife the block does not let out
    // would be drawn lying through a wall.
    expect(knifeGhostPoses(block({ base: { ...DEFAULT_BIN_PARAMS.base, solid: false } }))).toEqual(
      []
    );
    expect(knifeGhostPoses(block({ cutouts: [knifeSlot({ hidden: true })] }))).toEqual([]);
    expect(knifeGhostPoses(block({ cutouts: [knifeSlot({ groupId: 'g1' })] }))).toEqual([]);
    expect(knifeGhostPoses(block({ cutouts: [knifeSlot({ rotation: 45 })] }))).toEqual([]);
  });
});

describe('buildKnifeGhostPositions', () => {
  it('emits closed loops as segment pairs', () => {
    const { blade, handle } = knifeGhostProfile(CHEF);
    const positions = buildKnifeGhostPositions(block());
    expect(positions).toHaveLength((blade.length + handle.length) * 2 * 3);
  });

  it('never draws above the block top, and touches it at the spine', () => {
    const params = block();
    const positions = buildKnifeGhostPositions(params);
    const zs = positions.filter((_, i) => i % 3 === 2);
    expect(Math.max(...zs)).toBeCloseTo(knifeBlockTopZMm(params), 6);
  });

  it('runs the profile along the slot axis, at the slot centre across it', () => {
    const params = block();
    const positions = buildKnifeGhostPositions(params);
    const ys = positions.filter((_, i) => i % 3 === 1);
    const { innerD } = interior(params);
    const slotCentreY = 16 + 3.8 / 2 - innerD / 2;
    for (const y of ys) expect(y).toBeCloseTo(slotCentreY, 6);
  });

  it('is empty for a design with no open-ended knife slot', () => {
    expect(buildKnifeGhostPositions({ ...DEFAULT_BIN_PARAMS })).toEqual([]);
  });
});
