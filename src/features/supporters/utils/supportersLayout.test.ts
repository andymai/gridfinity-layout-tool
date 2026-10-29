import { describe, it, expect } from 'vitest';
import { computeCameraFrame, computeZonedLayout } from './supportersLayout';
import { fitLabelLines } from './labelText';

const SIZES = [27, 31, 22, 29, 25, 30, 26, 24, 29];

describe('computeZonedLayout', () => {
  const layout = computeZonedLayout(SIZES);
  const key = (p: { x: number; z: number }) => `${p.x},${p.z}`;
  const seats = SIZES.flatMap((size, zone) =>
    Array.from({ length: size }, (_, slot) => layout.seat(zone, slot))
  );

  it('gives every member of every zone its own socket on the plate', () => {
    const sockets = new Set(layout.sockets.map(key));
    expect(new Set(seats.map(key)).size).toBe(seats.length);
    for (const s of seats) expect(sockets.has(key(s))).toBe(true);
  });

  it('centres the plate on the origin on exact socket pitch', () => {
    const xs = layout.sockets.map((s) => s.x);
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs));
    for (const s of seats) expect(Math.abs(s.x * 2 - Math.round(s.x * 2))).toBeLessThan(1e-9);
  });

  it('keeps zones apart, so each department reads as its own compartment', () => {
    const zoneOf = new Map<string, number>();
    SIZES.forEach((size, zone) => {
      for (let slot = 0; slot < size; slot++) zoneOf.set(key(layout.seat(zone, slot)), zone);
    });
    for (const [k, zone] of zoneOf) {
      const [x, z] = k.split(',').map(Number);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const neighbour = zoneOf.get(`${x + dx},${z + dz}`);
        if (neighbour !== undefined) expect(neighbour).toBe(zone);
      }
    }
  });

  it('prints each label in front of its zone, never over a seat', () => {
    const taken = new Set(seats.map(key));
    for (const zone of layout.zones) {
      expect(zone.label.z).toBeGreaterThan(zone.z);
      for (let dx = -Math.floor(zone.width / 2); dx <= Math.floor(zone.width / 2); dx++) {
        expect(taken.has(key({ x: zone.label.x + dx, z: zone.label.z }))).toBe(false);
      }
    }
  });

  it('offers an empty socket as the vacant one', () => {
    const sockets = new Set(layout.sockets.map(key));
    expect(sockets.has(key(layout.vacant))).toBe(true);
    expect(new Set(seats.map(key)).has(key(layout.vacant))).toBe(false);
  });

  it('still has a vacant socket when every zone is exactly full', () => {
    const full = computeZonedLayout(Array.from({ length: 9 }, () => 6));
    const taken = new Set(
      Array.from({ length: 9 }, (_, zone) =>
        Array.from({ length: 6 }, (_, slot) => key(full.seat(zone, slot)))
      ).flat()
    );
    expect(taken.has(key(full.vacant))).toBe(false);
  });

  it('grows with the largest department', () => {
    const small = computeZonedLayout([4, 4, 4]);
    const large = computeZonedLayout([60, 4, 4]);
    expect(large.width).toBeGreaterThan(small.width);
  });
});

describe('computeCameraFrame', () => {
  it('pulls back further for larger plates', () => {
    const near = computeCameraFrame({ width: 5, depth: 4 }, 16 / 9);
    const far = computeCameraFrame({ width: 25, depth: 19 }, 16 / 9);
    expect(far.distance).toBeGreaterThan(near.distance);
  });

  it('pulls back further in portrait than landscape for the same plate', () => {
    const footprint = { width: 10, depth: 8 };
    const landscape = computeCameraFrame(footprint, 16 / 9);
    const portrait = computeCameraFrame(footprint, 9 / 16);
    expect(portrait.distance).toBeGreaterThan(landscape.distance);
  });

  it('positions the camera above and in front of the target', () => {
    const frame = computeCameraFrame({ width: 10, depth: 8 }, 16 / 9);
    expect(frame.position[1]).toBeGreaterThan(frame.target[1]);
    expect(frame.position[2]).toBeGreaterThan(frame.target[2]);
  });

  it('aims at the centre it is given, so one zone can fill the stage', () => {
    const frame = computeCameraFrame({ width: 6, depth: 5 }, 16 / 9, { x: 7, z: -4 });
    expect(frame.target[0]).toBe(7);
    expect(frame.target[2]).toBe(-4);
  });

  it('moves in closer when asked to frame tightly', () => {
    const loose = computeCameraFrame({ width: 12, depth: 10 }, 16 / 9);
    const tight = computeCameraFrame({ width: 12, depth: 10 }, 16 / 9, undefined, 0.7);
    expect(tight.distance).toBeLessThan(loose.distance);
  });
});

describe('fitLabelLines', () => {
  it('keeps a short name on one line', () => {
    expect(fitLabelLines('Max')).toEqual(['Max']);
  });

  it('wraps a two-word name across lines', () => {
    expect(fitLabelLines('Diego Silva')).toEqual(['Diego', 'Silva']);
  });

  it('hard-breaks a single long word across lines', () => {
    const lines = fitLabelLines('PummeledLeftNut', 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('PummeledL');
  });

  it('truncates with an ellipsis when it overflows maxLines', () => {
    const lines = fitLabelLines('Supercalifragilistic', 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('returns nothing for an empty name', () => {
    expect(fitLabelLines('   ')).toEqual([]);
  });
});
