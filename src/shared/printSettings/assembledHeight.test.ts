import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GRIDFINITY_SPEC as GRIDFINITY } from '@/shared/printSettings/gridfinityGeometry';
import type { BinParams } from '@/features/bin-designer/types';
import type { BaseplateHeightParams } from './baseplateHeight';
import { assembledHeight, hasSeatedLid, type AssembledSegmentKind } from './assembledHeight';

function params(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

/** The common plate: no magnets, no solid floor. */
const PLAIN_PLATE: BaseplateHeightParams = { magnetHoles: false, magnetDepth: 2.4 };

function bandOf(kind: AssembledSegmentKind, result: ReturnType<typeof assembledHeight>): number {
  return result.segments.find((s) => s.kind === kind)?.mm ?? 0;
}

const LIP_RISE = GRIDFINITY.LIP_HEIGHT;

describe('assembledHeight', () => {
  describe('band bookkeeping', () => {
    it('sums the bands to the total', () => {
      const result = assembledHeight(
        params({
          height: 6,
          lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
        }),
        PLAIN_PLATE
      );
      const sum = result.segments.reduce((acc, s) => acc + s.mm, 0);
      expect(sum).toBeCloseTo(result.totalMm, 6);
    });

    it('lays the bands out contiguously from the bottom', () => {
      const result = assembledHeight(
        params({ height: 6, lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } }),
        { magnetHoles: true, magnetDepth: 2 }
      );
      let expectedStart = 0;
      for (const segment of result.segments) {
        expect(segment.startMm).toBeCloseTo(expectedStart, 6);
        expectedStart += segment.mm;
      }
      expect(expectedStart).toBeCloseTo(result.totalMm, 6);
    });
  });

  describe('baseplate nesting', () => {
    it('adds nothing for a plain plate under a socketed bin', () => {
      const bare = assembledHeight(params({ height: 6 }));
      const seated = assembledHeight(params({ height: 6 }), PLAIN_PLATE);
      expect(bandOf('baseplate', seated)).toBe(0);
      expect(seated.totalMm).toBeCloseTo(bare.totalMm, 6);
    });

    it('still reports the plate as 5mm of printed material', () => {
      const seated = assembledHeight(params({ height: 6 }), PLAIN_PLATE);
      expect(seated.baseplatePrintedMm).toBe(GRIDFINITY.SOCKET_HEIGHT);
      expect(seated.nestedMm).toBe(GRIDFINITY.SOCKET_HEIGHT);
    });

    it('emits a zero-height plate band so the row can explain itself', () => {
      const seated = assembledHeight(params({ height: 6 }), PLAIN_PLATE);
      expect(seated.segments.some((s) => s.kind === 'baseplate')).toBe(true);
    });

    it('omits the plate band entirely for a bare bin', () => {
      const bare = assembledHeight(params({ height: 6 }));
      expect(bare.segments.some((s) => s.kind === 'baseplate')).toBe(false);
      expect(bare.baseplatePrintedMm).toBe(0);
    });

    it('adds only the magnet retaining floor, not the whole plate', () => {
      const seated = assembledHeight(params({ height: 6 }), {
        magnetHoles: true,
        magnetDepth: 2,
      });
      // MAGNET_FLOOR (0.5) + magnetDepth (2) = 2.5mm below the sockets.
      expect(bandOf('baseplate', seated)).toBeCloseTo(2.5, 6);
      expect(seated.baseplatePrintedMm).toBeCloseTo(GRIDFINITY.SOCKET_HEIGHT + 2.5, 6);
    });

    it('adds the solid-floor thickness on top of the magnet floor', () => {
      const seated = assembledHeight(params({ height: 6 }), {
        magnetHoles: true,
        magnetDepth: 2,
        solidFloor: true,
        solidFloorThickness: 3,
      });
      expect(bandOf('baseplate', seated)).toBeCloseTo(5.5, 6);
    });

    it('ignores the plate for a flat base, which does not seat on one', () => {
      // No socket means nothing nests, and a flat-base bin sits straight in the
      // drawer — charging it a plate would overstate clearance by 5mm.
      const flat = params({
        height: 6,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
      });
      const seated = assembledHeight(flat, PLAIN_PLATE);
      expect(seated.nestedMm).toBe(0);
      expect(seated.baseplatePrintedMm).toBe(0);
      expect(seated.segments.some((s) => s.kind === 'baseplate')).toBe(false);
      expect(seated.totalMm).toBeCloseTo(6 * 7, 6);
    });

    it('ignores a magnet plate for a flat base too', () => {
      const flat = params({
        height: 6,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
      });
      const seated = assembledHeight(flat, { magnetHoles: true, magnetDepth: 2 });
      expect(seated.totalMm).toBeCloseTo(6 * 7, 6);
    });

    it('reports no nesting for a socketed bin measured without a plate', () => {
      expect(assembledHeight(params({ height: 6 })).nestedMm).toBe(0);
    });
  });

  describe('bin body', () => {
    it('measures height units including the base', () => {
      const result = assembledHeight(
        params({ height: 6, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } })
      );
      expect(bandOf('bin', result)).toBeCloseTo(42, 6);
      expect(result.totalMm).toBeCloseTo(42, 6);
    });

    it('follows a non-default height unit', () => {
      const result = assembledHeight(
        params({
          height: 6,
          heightUnitMm: 10,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        })
      );
      expect(bandOf('bin', result)).toBeCloseTo(60, 6);
    });

    it('includes the extra wall-height collar', () => {
      const result = assembledHeight(
        params({
          height: 6,
          extraWallHeightMm: 8,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        })
      );
      expect(bandOf('bin', result)).toBeCloseTo(50, 6);
    });

    it('ignores a negative collar rather than shrinking the bin', () => {
      const result = assembledHeight(
        params({
          height: 6,
          extraWallHeightMm: -8,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        })
      );
      expect(bandOf('bin', result)).toBeCloseTo(42, 6);
    });
  });

  describe('stacking lip', () => {
    it('adds the full LIP_HEIGHT above the wall', () => {
      const result = assembledHeight(
        params({ height: 6, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } })
      );
      expect(bandOf('stackingLip', result)).toBeCloseTo(LIP_RISE, 6);
      expect(result.totalMm).toBeCloseTo(42 + LIP_RISE, 6);
    });

    it('reports the 9u lipped stack at its Gridfinity height (#3037)', () => {
      // 9u at 7mm = 63mm body, plus the spec's full 4.4mm lip.
      const result = assembledHeight(
        params({ height: 9, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } }),
        PLAIN_PLATE
      );
      expect(result.totalMm).toBeCloseTo(67.4, 6);
    });

    it('omits the band when the lip is off', () => {
      const result = assembledHeight(
        params({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } })
      );
      expect(result.segments.some((s) => s.kind === 'stackingLip')).toBe(false);
    });
  });

  describe('lid', () => {
    const lidded = (lid: Partial<BinParams['lid']> = {}): BinParams =>
      params({
        height: 6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
      });

    it('rises about 2.1mm above the lip for a standard lid', () => {
      expect(bandOf('lid', assembledHeight(lidded()))).toBeCloseTo(2.0929, 3);
    });

    it('grows by the extra-height knob', () => {
      const base = bandOf('lid', assembledHeight(lidded()));
      const tall = bandOf('lid', assembledHeight(lidded({ extraHeightMm: 12 })));
      expect(tall - base).toBeCloseTo(12, 6);
    });

    it('grows when the floor plate thickens past its baseline', () => {
      const base = bandOf('lid', assembledHeight(lidded()));
      const thick = bandOf('lid', assembledHeight(lidded({ topThicknessMm: 3 })));
      expect(thick - base).toBeCloseTo(3 - 0.8, 6);
    });

    it('adds no rise for a sliding lid, which rides at or below the wall top', () => {
      const slide = lidded({ attachment: 'slide' });
      expect(hasSeatedLid(slide)).toBe(false);
      expect(assembledHeight(slide).segments.some((s) => s.kind === 'lid')).toBe(false);
    });

    it('books no stack grid for a sliding lid either', () => {
      const slide = lidded({ attachment: 'slide', stackableTop: true });
      expect(assembledHeight(slide).segments.some((s) => s.kind === 'lidStackGrid')).toBe(false);
    });

    it('is omitted on a lip-less bin, which generates no lid', () => {
      const noLip = params({
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      });
      expect(hasSeatedLid(noLip)).toBe(false);
      expect(assembledHeight(noLip).segments.some((s) => s.kind === 'lid')).toBe(false);
    });

    it('is omitted when the lid is disabled', () => {
      expect(hasSeatedLid(params())).toBe(false);
    });

    describe('stack grid', () => {
      it('adds a SOCKET_HEIGHT slab when the top is stackable', () => {
        const result = assembledHeight(lidded({ stackableTop: true }));
        expect(bandOf('lidStackGrid', result)).toBe(GRIDFINITY.SOCKET_HEIGHT);
      });

      it('counts the same when the plate is printed separately and glued on', () => {
        const fused = assembledHeight(lidded({ stackableTop: true }));
        const split = assembledHeight(lidded({ stackableTop: true, separateStackPlate: true }));
        expect(split.totalMm).toBeCloseTo(fused.totalMm, 6);
      });

      it('is omitted when the top is not stackable', () => {
        const result = assembledHeight(lidded({ stackableTop: false }));
        expect(result.segments.some((s) => s.kind === 'lidStackGrid')).toBe(false);
      });

      it('is omitted when no lid is seated, however the flag is persisted', () => {
        const noLid = params({
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: false, stackableTop: true },
        });
        expect(assembledHeight(noLid).segments.some((s) => s.kind === 'lidStackGrid')).toBe(false);
      });
    });
  });

  describe('full assembly', () => {
    it('stacks plate floor, bin, lip, lid and grid in order', () => {
      const result = assembledHeight(
        params({
          height: 6,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
        }),
        { magnetHoles: true, magnetDepth: 2 }
      );
      expect(result.segments.map((s) => s.kind)).toEqual([
        'baseplate',
        'bin',
        'stackingLip',
        'lid',
        'lidStackGrid',
      ]);
      // 2.5 plate floor + 42 bin + 4.4 lip + ~2.093 lid + 5 grid
      expect(result.totalMm).toBeCloseTo(55.993, 3);
    });
  });
});

// A base-only bin's body is its feet plus a `wallThickness` floor slab and
// nothing more, so its bin band is SOCKET_HEIGHT + that slab rather than
// `height * heightUnitMm`. This is the readout drawer clearance is computed
// from, and `height` is inert on a tray (pinned to 1 only to satisfy the range
// validators), so reading it would overstate a 6.2mm body as 7mm and defeat the
// whole point of the mode.
describe('assembledHeight — base-only bin', () => {
  const tray = (overrides: Partial<BinParams['base']> = {}): BinParams =>
    params({ height: 1, base: { ...DEFAULT_BIN_PARAMS.base, tile: true, ...overrides } });
  const trayBodyMm = GRIDFINITY.SOCKET_HEIGHT + DEFAULT_BIN_PARAMS.wallThickness;

  it('reports feet plus the floor slab as the bin band, not the stored height', () => {
    const result = assembledHeight(tray());
    expect(bandOf('bin', result)).toBeCloseTo(trayBodyMm, 5);
  });

  // The slab IS the tray, so its thickness has to move the readout — a tray at
  // the thinnest wall setting is a materially shorter plate.
  it('tracks the wall thickness the slab is built from', () => {
    const thin = assembledHeight(params({ ...tray(), wallThickness: 0.4 }));
    expect(bandOf('bin', thin)).toBeCloseTo(GRIDFINITY.SOCKET_HEIGHT + 0.4, 5);
  });

  it('stands the body plus lip tall as a bare tray', () => {
    const result = assembledHeight(tray());
    expect(result.totalMm).toBeCloseTo(trayBodyMm + LIP_RISE, 5);
  });

  // The lip is a genuine choice on a tray, not forced on: without it the plate
  // is the slab alone, which is the whole appeal of the lip-less variant.
  it('drops the lip band for a lip-less tray', () => {
    const result = assembledHeight(tray({ stackingLip: false }));
    expect(bandOf('stackingLip', result)).toBe(0);
    expect(result.totalMm).toBeCloseTo(trayBodyMm, 5);
  });

  it('ignores a stored height that the validators happened to allow', () => {
    expect(assembledHeight(tray()).totalMm).toBeCloseTo(
      assembledHeight(params({ height: 8, base: { ...DEFAULT_BIN_PARAMS.base, tile: true } }))
        .totalMm,
      5
    );
  });

  // The flag is inert on a socketless base (no feet to stand on), exactly as the
  // spacer's is, so a crafted payload must not shrink an ordinary bin's readout.
  it('leaves a socketless base on the ordinary derivation', () => {
    const flatTray = params({
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', tile: true },
    });
    expect(bandOf('bin', assembledHeight(flatTray))).toBe(3 * DEFAULT_BIN_PARAMS.heightUnitMm);
  });

  // A tray keeps its lip, so the lip precondition alone would seat a lid on a
  // plate with no cavity to close and count a band the worker never builds.
  it('never seats a lid', () => {
    const withLid = params({
      height: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, tile: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    });
    expect(hasSeatedLid(withLid)).toBe(false);
    expect(bandOf('lid', assembledHeight(withLid))).toBe(0);
  });
});
