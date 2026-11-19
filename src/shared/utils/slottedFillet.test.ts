import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  cornerRiseMm,
  dividerFilletSeat,
  pieceCorners,
  resolveDividerFilletSeat,
  slottedFilletApplies,
  slottedFilletLimitMm,
  slottedFilletRadiusMm,
} from './slottedFillet';
import type { SlottedCavity } from './slottedFillet';
import {
  dividerGrooveDepth,
  getEffectiveSlotDimensions,
  tabEngagement,
} from '@/shared/utils/slotMath';

const CAVITY: SlottedCavity = { innerW: 81.1, innerD: 81.1, wallHeight: 37.25, hasLip: true };

function slotted(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    style: 'slotted',
    interiorFilletMm: 2.5,
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    ...overrides,
  };
}

describe('slottedFilletApplies', () => {
  it('builds the fillet on a slotted bin with a closed floor', () => {
    expect(slottedFilletApplies(slotted())).toBe(true);
  });

  it('leaves out a standard bin, a bin without a fillet and a custom shape', () => {
    expect(slottedFilletApplies(slotted({ style: 'standard' }))).toBe(false);
    expect(slottedFilletApplies(slotted({ interiorFilletMm: undefined }))).toBe(false);
    expect(
      slottedFilletApplies(slotted({ cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } }))
    ).toBe(false);
  });

  it('leaves out an open lightweight floor', () => {
    const params = slotted({ base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } });
    expect(slottedFilletApplies(params)).toBe(false);
  });
});

describe('slottedFilletRadiusMm', () => {
  it('builds the design radius when the dividers are far from every wall', () => {
    // The default 2.5 is held 0.1 under the shell's 2.55 corner, as the plan does.
    expect(slottedFilletRadiusMm(slotted(), CAVITY)).toBeCloseTo(2.45, 6);
  });

  it('stops the fillet short of a divider standing close to a wall', () => {
    // A custom grid with one line a tenth of the width in from the left wall.
    const params = slotted({
      interiorFilletMm: 10,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        layout: 'custom',
        customGrid: { cols: 10, rows: 1, cells: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
      },
    });
    const limit = slottedFilletLimitMm(params, CAVITY);
    expect(limit).toBeLessThan(10);
    const seat = resolveDividerFilletSeat(params, CAVITY);
    expect(seat).not.toBeNull();
    if (!seat) return;
    // The plan holds the floor radius 0.1 under its corner radius, as always.
    expect(seat.filletRadius).toBeCloseTo(limit - 0.1, 6);
    // The piece corner ends at least a reserve short of the line's near face.
    const nearFace = CAVITY.innerW / 10 - params.dividerPieces.thickness / 2;
    expect(seat.cornerRadius).toBeLessThanOrEqual(nearFace - 0.2 + 1e-9);
    expect(seat.cornerRadius).toBeGreaterThan(nearFace - 0.4);
  });

  it('holds a piece corner under the piece top and twice along a wall-to-wall piece', () => {
    const tall = slotted({ interiorFilletMm: 15, width: 1, depth: 1 });
    const small: SlottedCavity = { innerW: 39.1, innerD: 39.1, wallHeight: 37.25, hasLip: true };
    const seat = resolveDividerFilletSeat(tall, small);
    expect(seat).not.toBeNull();
    if (!seat) return;
    expect(2 * seat.cornerRadius).toBeLessThanOrEqual(small.innerW - 0.2 + 1e-9);

    const short = slotted({
      interiorFilletMm: 15,
      dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, height: 6 },
    });
    const shortSeat = resolveDividerFilletSeat(short, CAVITY);
    expect(shortSeat).not.toBeNull();
    if (!shortSeat) return;
    expect(shortSeat.cornerRadius).toBeLessThanOrEqual(6 - 0.2 + 1e-9);
  });

  it('builds no fillet when the pieces leave no room for one', () => {
    const params = slotted({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        layout: 'custom',
        customGrid: { cols: 50, rows: 1, cells: [0, ...Array.from({ length: 49 }, () => 1)] },
      },
    });
    expect(slottedFilletRadiusMm(params, CAVITY)).toBe(0);
    expect(resolveDividerFilletSeat(params, CAVITY)).toBeNull();
  });
});

describe('dividerFilletSeat', () => {
  it('grows the channel by half the slot and groove depths, and the corner by the clearance', () => {
    const seat = dividerFilletSeat(2.45, 0.6, 0.8, 0.25);
    expect(seat).toEqual({
      filletRadius: 2.45,
      channelRadius: 2.45 + 0.7,
      cornerRadius: 2.45 + 0.7 + 0.25,
      lockLift: 2.45 + 0.7 + 0.25,
    });
    expect(dividerFilletSeat(0, 0.6, 0.8, 0.25)).toBeNull();
  });

  for (const groove of [true, false]) {
    it(`cuts behind the fillet and lets the seated corner clear the channel (groove ${groove ? 'on' : 'off'})`, () => {
      const params = slotted({
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove: groove },
      });
      const seat = resolveDividerFilletSeat(params, CAVITY);
      expect(seat).not.toBeNull();
      if (!seat) return;
      const { thickness, clearance } = params.dividerPieces;
      const { slotDepth } = getEffectiveSlotDimensions(params.wallThickness, thickness, clearance);
      const gd = dividerGrooveDepth(params);
      const tab = tabEngagement(slotDepth, clearance);
      const r = seat.filletRadius;
      const rc = seat.channelRadius;
      const rp = seat.cornerRadius;
      // Section through the slot: u in from the wall face, z up from the floor top.
      const channel = { u: rc - slotDepth, z: rc - gd };
      const fillet = { u: r, z: r };
      const piece = { u: rp - tab, z: rp - gd };

      // Where the channel's boundary is its arc, every point of the fillet's
      // surface lies inside the channel, so the cut leaves no rounding behind.
      for (let i = 0; i <= 90; i++) {
        const a = Math.PI + (i * Math.PI) / 180;
        const fu = fillet.u + r * Math.cos(a);
        const fz = fillet.z + r * Math.sin(a);
        if (fu > channel.u || fz > channel.z) continue;
        expect(Math.hypot(fu - channel.u, fz - channel.z)).toBeLessThanOrEqual(rc + 1e-9);
      }

      // The seated corner stays inside the channel, standing clear of it by a
      // margin that only closes where both meet the seat.
      for (let i = 0; i <= 80; i++) {
        const a = Math.PI + (i * Math.PI) / 180;
        const pu = piece.u + rp * Math.cos(a);
        const pz = piece.z + rp * Math.sin(a);
        if (pu > channel.u) continue;
        const gap = rc - Math.hypot(pu - channel.u, pz - channel.z);
        expect(gap).toBeGreaterThan(0);
      }
      // Above the curve the tab is straight and fully engaged in the slot.
      expect(piece.z).toBeLessThanOrEqual(seat.lockLift - gd + 1e-9);
      expect(channel.z).toBeLessThan(piece.z);
    });
  }
});

describe('pieceCorners', () => {
  it('names the rounded ends, or null when there is no fillet or no wall end', () => {
    const seat = dividerFilletSeat(2.45, 0.6, 0.8, 0.25);
    const corners = pieceCorners(seat, true, false);
    expect(corners?.radius).toBeCloseTo(3.4, 9);
    expect(corners?.low).toBe(true);
    expect(corners?.high).toBe(false);
    expect(pieceCorners(seat, false, false)).toBeNull();
    expect(pieceCorners(null, true, true)).toBeNull();
  });
});

describe('cornerRiseMm', () => {
  it('is the full radius at the end and nothing past the radius', () => {
    expect(cornerRiseMm(3, 0)).toBeCloseTo(3, 9);
    expect(cornerRiseMm(3, 3)).toBe(0);
    expect(cornerRiseMm(3, 1.5)).toBeCloseTo(3 - Math.sqrt(9 - 2.25), 9);
  });
});
