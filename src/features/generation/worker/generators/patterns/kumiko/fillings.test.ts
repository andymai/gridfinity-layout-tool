import { describe, it, expect } from 'vitest';
import { generateKumikoLattice } from './segmentLattice';
import { MITSUKUDE_DEF } from './mitsukude';
import { ASANOHA_DEF } from './asanoha';
import { GOMA_DEF } from './goma';
import { MIKADO_DEF } from './mikado';
import { TSUMIISHI_KIKKO_DEF } from './tsumiishiKikko';
import { RINDO_DEF } from './rindo';
import { SAKURA_DEF } from './sakura';
import { replicateRotations, SIX_FOLD } from './fillingUtils';
import type { KumikoPatternDef } from './types';

const BAND = { perimeter: 160, bandHeight: 20 };
const CELL = 9;
const PITCH = (CELL * Math.sqrt(3)) / 2;

const FILLED_DEFS: KumikoPatternDef[] = [
  ASANOHA_DEF,
  GOMA_DEF,
  MIKADO_DEF,
  TSUMIISHI_KIKKO_DEF,
  RINDO_DEF,
  SAKURA_DEF,
];

describe('kumiko vertex fillings', () => {
  it('filled patterns provide a template and stamp vertices; the bare grid neither', () => {
    const bare = generateKumikoLattice(MITSUKUDE_DEF, BAND, CELL);
    expect(bare.fillingTemplate).toHaveLength(0);
    expect(bare.vertices).toHaveLength(0);
    for (const def of FILLED_DEFS) {
      const lattice = generateKumikoLattice(def, BAND, CELL);
      expect(lattice.fillingTemplate.length, def.id).toBeGreaterThan(0);
      expect(lattice.vertices.length, def.id).toBeGreaterThan(0);
    }
  });

  it('places stamp vertices on the jigumi grid within the band margin', () => {
    const lattice = generateKumikoLattice(ASANOHA_DEF, BAND, CELL);
    for (const vertex of lattice.vertices) {
      expect(vertex.u).toBeGreaterThanOrEqual(0);
      expect(vertex.u).toBeLessThan(BAND.perimeter);
      expect(vertex.z).toBeGreaterThanOrEqual(-lattice.cellSize - 1e-9);
      expect(vertex.z).toBeLessThanOrEqual(BAND.bandHeight + lattice.cellSize + 1e-9);
      // Column positions are integer multiples of the pitch, staggered rows.
      const k = Math.round(vertex.u / lattice.columnPitch);
      expect(vertex.u).toBeCloseTo(k * lattice.columnPitch, 9);
    }
  });

  it('emits templates with three-fold rotational symmetry', () => {
    // Three-fold is the invariant every kumiko filling shares: pure six-fold
    // fillings satisfy it, and arm-spanning pieces (goma ribs, tsumiishi
    // ledges) are deliberately three-fold so arm-sharing vertices don't emit
    // coincident duplicates.
    const rot120 = ([x, z]: readonly [number, number]): readonly [number, number] => {
      const c = Math.cos((2 * Math.PI) / 3);
      const s = Math.sin((2 * Math.PI) / 3);
      return [x * c - z * s, x * s + z * c];
    };
    const same = (p: readonly [number, number], q: readonly [number, number]): boolean =>
      Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;

    for (const def of FILLED_DEFS) {
      const filling = def.filling;
      expect(filling, def.id).toBeDefined();
      if (!filling) continue;
      const segs = filling(CELL, PITCH);
      expect(segs.length % 3, def.id).toBe(0);
      for (const seg of segs) {
        const a = rot120(seg.a);
        const b = rot120(seg.b);
        const hasCounterpart = segs.some(
          (other) =>
            (same(other.a, a) && same(other.b, b)) || (same(other.a, b) && same(other.b, a))
        );
        expect(hasCounterpart, `${def.id}: rotated segment missing`).toBe(true);
      }
    }
  });

  it('asanoha spokes reach the triangle centroids', () => {
    const filling = ASANOHA_DEF.filling;
    if (!filling) throw new Error('missing filling');
    const segs = filling(CELL, PITCH);
    expect(segs).toHaveLength(6);
    for (const { a, b } of segs) {
      expect(Math.hypot(a[0], a[1])).toBeCloseTo(0, 9);
      expect(Math.hypot(b[0], b[1])).toBeCloseTo((2 * PITCH) / 3, 9);
    }
  });

  it('rindo chords connect adjacent arm midpoints', () => {
    const filling = RINDO_DEF.filling;
    if (!filling) throw new Error('missing filling');
    const segs = filling(CELL, PITCH);
    expect(segs).toHaveLength(6);
    // Both endpoints sit at arm-midpoint distance s/2 from the vertex.
    for (const { a, b } of segs) {
      expect(Math.hypot(a[0], a[1])).toBeCloseTo(CELL / 2, 6);
      expect(Math.hypot(b[0], b[1])).toBeCloseTo(CELL / 2, 6);
    }
  });

  it('sakura petals are solid capsules with a per-segment width', () => {
    const filling = SAKURA_DEF.filling;
    if (!filling) throw new Error('missing filling');
    const segs = filling(CELL, PITCH);
    expect(segs).toHaveLength(6);
    for (const seg of segs) {
      expect(seg.width).toBeCloseTo(0.28 * CELL, 9);
    }
  });

  it('replicateRotations preserves rotation-step count and widths', () => {
    const segs = replicateRotations(
      [
        { a: [0, 1], b: [0, 2], width: 2.5 },
        { a: [1, 0], b: [2, 0] },
      ],
      SIX_FOLD
    );
    expect(segs).toHaveLength(12);
    expect(segs.filter((s) => s.width !== undefined)).toHaveLength(6);
  });
});
