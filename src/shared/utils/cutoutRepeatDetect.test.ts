import { describe, it, expect } from 'vitest';
import {
  detectRepeatPattern,
  REPEAT_POSITION_TOLERANCE,
  MIN_REPEAT_SELECTION,
} from './cutoutRepeatDetect';
import { expandCutoutArray } from './cutoutArray';
import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';

const BIN_W = 200;
const BIN_D = 200;

function cutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 12,
    depth: 8,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function cfg(overrides: Partial<CutoutArrayConfig> = {}): CutoutArrayConfig {
  return {
    mode: 'grid',
    cols: 3,
    rows: 2,
    pitchX: 20,
    pitchY: 16,
    count: 6,
    radius: 30,
    startAngle: 0,
    rotateToCenter: false,
    ...overrides,
  };
}

/** Expand a master+config into standalone cutouts, as a hand-built layout. */
function asPlacedCutouts(master: Cutout, config: CutoutArrayConfig): Cutout[] {
  return expandCutoutArray({ ...master, array: config }).map((c, i) => ({
    ...c,
    id: `p${i}`,
    array: undefined,
  }));
}

/** Nudge one cutout, to simulate imperfect hand alignment. */
function nudge(cutouts: Cutout[], index: number, dx: number, dy: number): Cutout[] {
  return cutouts.map((c, i) => (i === index ? { ...c, x: c.x + dx, y: c.y + dy } : c));
}

describe('round trip against expandCutoutArray', () => {
  it.each([
    ['grid 3x2', cfg({ mode: 'grid', cols: 3, rows: 2, pitchX: 20, pitchY: 16 })],
    ['grid single row', cfg({ mode: 'grid', cols: 5, rows: 1, pitchX: 18 })],
    ['grid single column', cfg({ mode: 'grid', cols: 1, rows: 4, pitchY: 14 })],
    ['staggered 3x3', cfg({ mode: 'staggered', cols: 3, rows: 3, pitchX: 20, pitchY: 16 })],
    ['staggered 4x2', cfg({ mode: 'staggered', cols: 4, rows: 2, pitchX: 16, pitchY: 20 })],
  ])('recovers the layout of %s', (_name, config) => {
    const placed = asPlacedCutouts(cutout(), config);
    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found).not.toBeNull();
    expect(found?.mode).toBe(config.mode);
    expect(found?.config.cols).toBe(config.cols);
    expect(found?.config.rows).toBe(config.rows);
    if (config.cols > 1) expect(found?.config.pitchX).toBeCloseTo(config.pitchX, 3);
    if (config.rows > 1) expect(found?.config.pitchY).toBeCloseTo(config.pitchY, 3);
    expect(found?.maxDriftMm).toBe(0);
  });

  it('recovers a radial ring without instance rotation', () => {
    const config = cfg({
      mode: 'radial',
      count: 6,
      radius: 30,
      startAngle: 0,
      rotateToCenter: false,
    });
    const placed = asPlacedCutouts(cutout({ x: 80, y: 80 }), config);

    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found?.mode).toBe('radial');
    expect(found?.config.count).toBe(6);
    expect(found?.config.radius).toBeCloseTo(30, 1);
    expect(found?.config.rotateToCenter).toBe(false);
  });

  it('recovers a radial ring whose instances turn with it', () => {
    const config = cfg({
      mode: 'radial',
      count: 8,
      radius: 40,
      startAngle: 0,
      rotateToCenter: true,
    });
    const placed = asPlacedCutouts(cutout({ x: 80, y: 80 }), config);

    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found?.mode).toBe('radial');
    expect(found?.config.count).toBe(8);
    expect(found?.config.rotateToCenter).toBe(true);
  });

  it('re-expands to the same positions it was detected from', () => {
    const config = cfg({ mode: 'grid', cols: 4, rows: 2, pitchX: 20, pitchY: 16 });
    const placed = asPlacedCutouts(cutout(), config);
    const found = detectRepeatPattern(placed, BIN_W, BIN_D);
    if (!found) throw new Error('expected a detection');

    const master = placed.find((c) => c.id === found.masterId);
    if (!master) throw new Error('expected the master to be one of the inputs');
    const rebuilt = expandCutoutArray({ ...master, array: found.config });

    const key = (c: Cutout) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`;
    expect(new Set(rebuilt.map(key))).toEqual(new Set(placed.map(key)));
  });
});

describe('master selection', () => {
  it('picks the bottom-left cutout, because the grid grows in +X/+Y', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 2 }));
    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    const master = placed.find((c) => c.id === found?.masterId);
    expect(master?.x).toBe(Math.min(...placed.map((c) => c.x)));
    expect(master?.y).toBe(Math.min(...placed.map((c) => c.y)));
  });

  it('absorbs every cutout except the master', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 2 }));
    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found?.absorbedIds).toHaveLength(placed.length - 1);
    expect(found?.absorbedIds).not.toContain(found?.masterId);
  });

  it('is order-independent', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 2 }));
    const forward = detectRepeatPattern(placed, BIN_W, BIN_D);
    const reversed = detectRepeatPattern([...placed].reverse(), BIN_W, BIN_D);

    expect(reversed?.masterId).toBe(forward?.masterId);
    expect(reversed?.config).toEqual(forward?.config);
  });
});

describe('tolerance for hand alignment', () => {
  it('accepts drift inside the tolerance and reports how far things move', () => {
    const placed = nudge(asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })), 1, 0.3, 0);

    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found).not.toBeNull();
    expect(found?.maxDriftMm).toBeGreaterThan(0);
    expect(found?.maxDriftMm).toBeLessThanOrEqual(REPEAT_POSITION_TOLERANCE);
  });

  it('rejects drift beyond the tolerance rather than dragging cutouts into line', () => {
    const placed = nudge(asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })), 1, 3, 0);

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('never reports a drift larger than the tolerance', () => {
    const placed = nudge(
      nudge(asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 2 })), 2, 0.4, -0.2),
      4,
      -0.3,
      0.4
    );

    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found?.maxDriftMm).toBeLessThanOrEqual(REPEAT_POSITION_TOLERANCE + 0.01);
  });
});

describe('arrangements that are not a pattern', () => {
  it('declines fewer than the minimum selection', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 2, rows: 1 }));
    expect(placed.length).toBeLessThan(MIN_REPEAT_SELECTION);
    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines a ragged grid with a hole in it', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 2 }));
    expect(detectRepeatPattern(placed.slice(0, 5), BIN_W, BIN_D)).toBeNull();
  });

  it('declines cutouts of differing size', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 }));
    placed[1] = { ...placed[1], width: 20 };

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines cutouts of differing cut depth', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 }));
    placed[2] = { ...placed[2], cutDepth: 9 };

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines mixed rotations in a grid, which cannot be expressed', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 }));
    placed[1] = { ...placed[1], rotation: 45 };

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines a path cutout, which cannot carry a repeat', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })).map((c) => ({
      ...c,
      shape: 'path' as const,
      path: [{ x: 0, y: 0, handleIn: null, handleOut: null, symmetric: true }],
    }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines grouped cutouts, which cannot carry a repeat', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })).map((c) => ({
      ...c,
      groupId: 'g1',
    }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines a locked cutout rather than moving it', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 }));
    placed[1] = { ...placed[1], locked: true };

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines a cutout that already carries a repeat', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 }));
    placed[0] = { ...placed[0], array: cfg() };

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });
});

describe('spacing the user actually placed', () => {
  it('accepts shapes packed edge to edge', () => {
    // Detection is the way back from a flattened repeat, so it has to be able
    // to describe what is on the board. Nothing stops two independent cutouts
    // from touching, and an array is not held to a stricter rule.
    const placed = asPlacedCutouts(cutout({ width: 12 }), cfg({ cols: 3, rows: 1, pitchX: 12 }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).not.toBeNull();
  });

  it('accepts shapes that deliberately overlap', () => {
    const placed = asPlacedCutouts(cutout({ width: 12 }), cfg({ cols: 3, rows: 1, pitchX: 8 }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).not.toBeNull();
  });
});

describe('engraved text', () => {
  it('declines when instances carry different engraved labels', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })).map((c, i) => ({
      ...c,
      label: `S${i}`,
      engraveLabel: true,
    }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('declines when only some instances carry an engraved label', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 }));
    placed[1] = { ...placed[1], label: '10mm', engraveLabel: true };

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).toBeNull();
  });

  it('accepts one label shared by every instance, which survives the merge', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })).map((c) => ({
      ...c,
      label: '10mm',
      engraveLabel: true,
    }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).not.toBeNull();
  });

  it('ignores a label that is stored but not engraved', () => {
    const placed = asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 1 })).map((c, i) => ({
      ...c,
      label: `note ${i}`,
      engraveLabel: false,
    }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).not.toBeNull();
  });
});

describe('colour', () => {
  it('reports a conflict when an instance is painted differently', () => {
    const placed = asPlacedCutouts(cutout({ color: '#ff0000' }), cfg({ cols: 3, rows: 1 }));
    placed[1] = { ...placed[1], color: '#00ff00' };

    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    expect(found).not.toBeNull();
    expect(found?.colorConflict).toBe(true);
  });

  it('reports no conflict when every instance shares one colour', () => {
    const placed = asPlacedCutouts(cutout({ color: '#ff0000' }), cfg({ cols: 3, rows: 1 }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)?.colorConflict).toBe(false);
  });
});

describe('the fit never moves a cutout further than it promises', () => {
  const RING = cfg({ mode: 'radial', count: 8, radius: 150, startAngle: 0 });
  const ringCutouts = () => asPlacedCutouts(cutout({ x: 400, y: 400 }), RING);

  /** Rotate one instance about the ring's own centre by `deg`. */
  function skewOne(cutouts: Cutout[], index: number, deg: number): Cutout[] {
    const centers = cutouts.map((c) => ({ x: c.x + c.width / 2, y: c.y + c.depth / 2 }));
    const hubX = centers.reduce((s, p) => s + p.x, 0) / centers.length;
    const hubY = centers.reduce((s, p) => s + p.y, 0) / centers.length;
    return cutouts.map((c, i) => {
      if (i !== index) return c;
      const { x, y } = centers[i];
      const r = Math.hypot(x - hubX, y - hubY);
      const a = Math.atan2(y - hubY, x - hubX) + (deg * Math.PI) / 180;
      return {
        ...c,
        x: hubX + r * Math.cos(a) - c.width / 2,
        y: hubY + r * Math.sin(a) - c.depth / 2,
      };
    });
  }

  it('accepts an exact ring at a large radius', () => {
    expect(detectRepeatPattern(ringCutouts(), 800, 800)).not.toBeNull();
  });

  it('declines a ring whose angular slack would drag an instance past the bound', () => {
    // An angular error is an ARC, so its cost in mm scales with the radius: at
    // r = 150 a 1 degree offset is ~2.6mm of travel. That sits inside the
    // angular tolerance, so only the distance bound can catch it.
    const skewed = skewOne(ringCutouts(), 3, 1);

    expect(detectRepeatPattern(skewed, 800, 800)).toBeNull();
  });

  it('never reports a drift above the diagonal of the per-axis tolerance', () => {
    const placed = nudge(
      nudge(asPlacedCutouts(cutout(), cfg({ cols: 3, rows: 2 })), 2, 0.5, 0.5),
      4,
      -0.5,
      0.5
    );

    const found = detectRepeatPattern(placed, BIN_W, BIN_D);

    if (found) {
      expect(found.maxDriftMm).toBeLessThanOrEqual(REPEAT_POSITION_TOLERANCE * Math.SQRT2 + 0.01);
    }
  });
});

describe('bin bounds', () => {
  it('declines a pattern that runs off the bin', () => {
    const placed = asPlacedCutouts(cutout({ x: 10, y: 10 }), cfg({ cols: 4, rows: 1, pitchX: 30 }));

    expect(detectRepeatPattern(placed, 60, 60)).toBeNull();
  });

  it('accepts the same pattern on a bin large enough to hold it', () => {
    const placed = asPlacedCutouts(cutout({ x: 10, y: 10 }), cfg({ cols: 4, rows: 1, pitchX: 30 }));

    expect(detectRepeatPattern(placed, BIN_W, BIN_D)).not.toBeNull();
  });
});
