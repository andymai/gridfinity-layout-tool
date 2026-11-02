import { describe, it, expect } from 'vitest';
import {
  clearedProfile,
  cutoutEntryProfile,
  entryChamferWidth,
  entryEdgeStations,
} from './cutoutFit';

describe('clearedProfile', () => {
  it('grows an insert shape by its clearance and keeps a polygon regular', () => {
    expect(clearedProfile({ shape: 'circle', width: 10, depth: 10, clearance: 0.2 })).toEqual({
      clearance: 0.2,
      w: 10.2,
      d: 10.2,
    });
    const hex = clearedProfile({ shape: 'polygon', width: 20, depth: 10, clearance: 1 });
    expect(hex.w / hex.d).toBeCloseTo(2, 9);
    expect(hex.d).toBe(11);
  });

  it('ignores a clearance left on a shape that takes none', () => {
    expect(clearedProfile({ shape: 'rectangle', width: 10, depth: 5, clearance: 1 })).toEqual({
      clearance: 0,
      w: 10,
      d: 5,
    });
  });
});

describe('entryChamferWidth', () => {
  it('keeps a straight wall under the bevel', () => {
    expect(entryChamferWidth({ shape: 'slot', cutDepth: 10, chamferWidth: 0.8 })).toBe(0.8);
    expect(entryChamferWidth({ shape: 'slot', cutDepth: 0.6, chamferWidth: 0.8 })).toBeCloseTo(
      0.4,
      9
    );
  });

  it('gives none to a shape that takes none', () => {
    expect(entryChamferWidth({ shape: 'text', cutDepth: 10, chamferWidth: 0.8 })).toBe(0);
  });
});

describe('entryEdgeStations', () => {
  it('runs a chamfer straight from the foot to the mouth', () => {
    expect(entryEdgeStations('chamfer')).toEqual([
      { grow: 0, rise: 0 },
      { grow: 1, rise: 1 },
    ]);
  });

  it('runs a round along the quarter circle centred out and down from the edge', () => {
    const stations = entryEdgeStations('round', 6);
    expect(stations).toHaveLength(7);
    expect(stations[0]).toEqual({ grow: 0, rise: 0 });
    expect(stations[6].grow).toBeCloseTo(1, 9);
    expect(stations[6].rise).toBeCloseTo(1, 9);
    for (const { grow, rise } of stations) {
      expect((1 - grow) ** 2 + rise ** 2).toBeCloseTo(1, 9);
    }
  });

  it('leaves the wall and meets the top tangentially', () => {
    const [foot, first] = entryEdgeStations('round', 6);
    const last = entryEdgeStations('round', 6).slice(-2);
    // Steep off the wall, flat into the top.
    expect((first.grow - foot.grow) / (first.rise - foot.rise)).toBeLessThan(0.15);
    expect((last[1].rise - last[0].rise) / (last[1].grow - last[0].grow)).toBeLessThan(0.15);
  });
});

describe('cutoutEntryProfile', () => {
  it('reads an absent profile as a chamfer', () => {
    expect(cutoutEntryProfile({})).toBe('chamfer');
    expect(cutoutEntryProfile({ entryProfile: 'round' })).toBe('round');
  });
});
