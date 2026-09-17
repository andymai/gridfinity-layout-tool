import { describe, it, expect } from 'vitest';
import {
  MAGNET_CHAMFER_MM,
  MAGNET_CHAMFER_MIN_WALL_MM,
  MAGNET_CRUSH_RIB_COUNT,
  MAGNET_CRUSH_RIB_DEPTH_MM,
  PLAIN_MAGNET_HOLE,
  attachmentHoleStyle,
  isPlainMagnetHole,
  magnetBoreProfile,
  magnetBoreRadiusAt,
  magnetBoreSegments,
  magnetChamferFits,
  magnetHoleStyleFrom,
  magnetHoleStyleKey,
  magnetMouthRadius,
} from './magnetHoleStyle';

const RIBS = { crushRibs: true, chamfer: false };
const BOTH = { crushRibs: true, chamfer: true };

describe('magnetHoleStyleFrom', () => {
  it('reads absent flags as off', () => {
    expect(magnetHoleStyleFrom({})).toEqual(PLAIN_MAGNET_HOLE);
    expect(magnetHoleStyleFrom({ magnetCrushRibs: true })).toEqual(RIBS);
    expect(attachmentHoleStyle({ magnetChamfer: true })).toEqual({
      crushRibs: false,
      chamfer: true,
    });
    expect(isPlainMagnetHole(PLAIN_MAGNET_HOLE)).toBe(true);
    expect(isPlainMagnetHole(RIBS)).toBe(false);
  });
});

describe('magnetHoleStyleKey', () => {
  it('is empty for a plain bore so existing cache keys stay byte-identical', () => {
    expect(magnetHoleStyleKey(PLAIN_MAGNET_HOLE)).toBe('');
    expect(magnetHoleStyleKey(RIBS)).toBe('ribs');
    expect(magnetHoleStyleKey({ crushRibs: false, chamfer: true })).toBe('chamfer');
    expect(magnetHoleStyleKey(BOTH)).toBe('ribs+chamfer');
  });
});

describe('bore profile', () => {
  it('peaks on the nominal bore and troughs one rib depth inside it', () => {
    const r = 3.25;
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < 720; i++) {
      const value = magnetBoreRadiusAt((i / 720) * Math.PI * 2, r, RIBS);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    expect(max).toBeCloseTo(r, 6);
    expect(min).toBeCloseTo(r - MAGNET_CRUSH_RIB_DEPTH_MM, 6);
    expect(magnetBoreRadiusAt(1.234, r, PLAIN_MAGNET_HOLE)).toBe(r);
  });

  it('repeats once per rib', () => {
    const r = 3;
    const step = (Math.PI * 2) / MAGNET_CRUSH_RIB_COUNT;
    for (let k = 0; k < MAGNET_CRUSH_RIB_COUNT; k++) {
      expect(magnetBoreRadiusAt(k * step, r, RIBS)).toBeCloseTo(r, 9);
      expect(magnetBoreRadiusAt(k * step + step / 2, r, RIBS)).toBeCloseTo(
        r - MAGNET_CRUSH_RIB_DEPTH_MM,
        9
      );
    }
  });

  it('rings a ribbed bore densely enough to draw the wave', () => {
    expect(magnetBoreSegments(PLAIN_MAGNET_HOLE, 16)).toBe(16);
    expect(magnetBoreSegments(RIBS, 16)).toBeGreaterThanOrEqual(MAGNET_CRUSH_RIB_COUNT * 8);
    const ring = magnetBoreProfile(3.25, RIBS, 64);
    expect(ring).toHaveLength(64);
    expect(Math.hypot(ring[0][0], ring[0][1])).toBeCloseTo(3.25, 6);
    expect(Math.hypot(ring[4][0], ring[4][1])).toBeCloseTo(3.25 - MAGNET_CRUSH_RIB_DEPTH_MM, 6);
  });
});

describe('chamfer', () => {
  it('widens the mouth by the chamfer only when on', () => {
    expect(magnetMouthRadius(3.25, PLAIN_MAGNET_HOLE)).toBe(3.25);
    expect(magnetMouthRadius(3.25, BOTH)).toBe(3.25 + MAGNET_CHAMFER_MM);
  });

  it('fits only where the wall beyond the mouth survives', () => {
    expect(magnetChamferFits(MAGNET_CHAMFER_MM + MAGNET_CHAMFER_MIN_WALL_MM)).toBe(true);
    expect(magnetChamferFits(MAGNET_CHAMFER_MM + MAGNET_CHAMFER_MIN_WALL_MM - 0.01)).toBe(false);
    // The walls the fit rule is applied to today: lightweight pads (1.2),
    // lid retention bosses (1.0) and detachable feet (1.2) all keep the plain mouth.
    expect(magnetChamferFits(1.2)).toBe(false);
    expect(magnetChamferFits(1.0)).toBe(false);
  });
});
