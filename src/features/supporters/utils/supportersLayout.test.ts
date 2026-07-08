import { describe, it, expect } from 'vitest';
import { computeBaseplateLayout, computeCameraFrame } from './supportersLayout';
import { fitLabelLines } from './labelText';

describe('computeBaseplateLayout', () => {
  it('places one socket seat per supporter', () => {
    expect(computeBaseplateLayout(32).positions).toHaveLength(32);
  });

  it('centers the plate on the origin', () => {
    const { sockets } = computeBaseplateLayout(32);
    const meanX = sockets.reduce((s, p) => s + p.x, 0) / sockets.length;
    const meanZ = sockets.reduce((s, p) => s + p.z, 0) / sockets.length;
    expect(Math.abs(meanX)).toBeLessThan(1e-9);
    expect(Math.abs(meanZ)).toBeLessThan(1e-9);
  });

  it('produces a slightly-wide grid (columns >= rows)', () => {
    const { columns, rows } = computeBaseplateLayout(32);
    expect(columns).toBeGreaterThanOrEqual(rows);
  });

  it('seats bins on exact 1-unit socket pitch', () => {
    const { positions } = computeBaseplateLayout(9);
    const xs = [...new Set(positions.map((p) => p.x))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeCloseTo(1, 9);
    }
  });

  it('adds a one-socket empty margin ring around the bin cluster', () => {
    const layout = computeBaseplateLayout(12);
    expect(layout.plateColumns).toBe(layout.columns + 2);
    expect(layout.plateRows).toBe(layout.rows + 2);
    expect(layout.sockets).toHaveLength(layout.plateColumns * layout.plateRows);
  });

  it('never seats a bin on the margin ring', () => {
    const layout = computeBaseplateLayout(25);
    for (const p of layout.positions) {
      expect(p.col).toBeGreaterThanOrEqual(1);
      expect(p.col).toBeLessThanOrEqual(layout.plateColumns - 2);
      expect(p.row).toBeGreaterThanOrEqual(1);
      expect(p.row).toBeLessThanOrEqual(layout.plateRows - 2);
    }
  });

  it('handles a single supporter', () => {
    const layout = computeBaseplateLayout(1);
    expect(layout.columns).toBe(1);
    expect(layout.positions[0]).toMatchObject({ x: 0, z: 0 });
  });

  it('handles zero supporters with a non-empty plate', () => {
    const layout = computeBaseplateLayout(0);
    expect(layout.positions).toHaveLength(0);
    expect(layout.sockets.length).toBeGreaterThan(0);
  });

  it('grows the plate as supporters grow', () => {
    const small = computeBaseplateLayout(10);
    const large = computeBaseplateLayout(400);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.positions).toHaveLength(400);
  });
});

describe('computeCameraFrame', () => {
  it('pulls back further for larger plates', () => {
    const near = computeCameraFrame(computeBaseplateLayout(10), 16 / 9);
    const far = computeCameraFrame(computeBaseplateLayout(400), 16 / 9);
    expect(far.distance).toBeGreaterThan(near.distance);
  });

  it('pulls back further in portrait than landscape for the same plate', () => {
    const layout = computeBaseplateLayout(40);
    const landscape = computeCameraFrame(layout, 16 / 9);
    const portrait = computeCameraFrame(layout, 9 / 16);
    expect(portrait.distance).toBeGreaterThan(landscape.distance);
  });

  it('positions the camera above and in front of the target', () => {
    const frame = computeCameraFrame(computeBaseplateLayout(42), 16 / 9);
    expect(frame.position[1]).toBeGreaterThan(frame.target[1]);
    expect(frame.position[2]).toBeGreaterThan(frame.target[2]);
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
