/**
 * Real-kernel checks for wall patterns on REMOVABLE divider pieces (#2811).
 *
 * The pieces never appear in the bin mesh — they are separate parts exported
 * on their own — so the bin scenario suite can't cover them. These build the
 * actual solids and measure them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildUniqueDividerPieces } from './dividerBuilder';
import type { LabeledDividerPiece } from './dividerBuilder';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const INNER_W = 3 * 42 - 0.5 - 2 * 1.2;
const INNER_D = 2 * 42 - 0.5 - 2 * 1.2;
const WALL_HEIGHT = 6 * 7 - 4.75;

function slotted(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    style: 'slotted',
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    ...overrides,
  };
}

function withPattern(params: BinParams, dividers: boolean): BinParams {
  return { ...params, wallPattern: { enabled: true, pattern: 'honeycomb', dividers } };
}

/** Enclosed volume of a solid, via the signed-tetrahedron sum over its mesh. */
function solidVolume(solid: Shape3D): number {
  const m = mesh(solid, { tolerance: 0.05, angularTolerance: 0.3, cache: false });
  const v = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
  const idx = m.triangles instanceof Uint32Array ? m.triangles : new Uint32Array(m.triangles);
  let total = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = (idx[i] ?? 0) * 3;
    const b = (idx[i + 1] ?? 0) * 3;
    const c = (idx[i + 2] ?? 0) * 3;
    const ax = v[a] ?? 0,
      ay = v[a + 1] ?? 0,
      az = v[a + 2] ?? 0;
    const bx = v[b] ?? 0,
      by = v[b + 1] ?? 0,
      bz = v[b + 2] ?? 0;
    const cx = v[c] ?? 0,
      cy = v[c + 1] ?? 0,
      cz = v[c + 2] ?? 0;
    total += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(total) / 6;
}

/** Build pieces, measure total volume, then dispose every handle. */
function measure(params: BinParams): { volume: number; count: number } {
  const pieces: LabeledDividerPiece[] = buildUniqueDividerPieces(
    params,
    INNER_W,
    INNER_D,
    WALL_HEIGHT,
    DEFAULT_BIN_PARAMS.base.stackingLip
  );
  try {
    let volume = 0;
    for (const piece of pieces) volume += solidVolume(piece.shape);
    return { volume, count: pieces.length };
  } finally {
    for (const piece of pieces) {
      try {
        piece.shape.delete();
      } catch {
        /* already cleaned */
      }
    }
  }
}

describe('wall pattern on removable divider pieces', () => {
  it('perforates the piece when the option is on', () => {
    const base = slotted();
    const solid = measure(withPattern(base, false));
    const patterned = measure(withPattern(base, true));

    expect(patterned.count).toBe(solid.count);
    expect(solid.volume).toBeGreaterThan(0);
    expect(
      patterned.volume,
      'the divider option removed no material from the printed piece'
    ).toBeLessThan(solid.volume);
    // Honeycomb is ~90% open across its band, so removing over half the piece
    // is expected here. The floor guards against the piece being consumed
    // outright — which is what a failed keep-out or a runaway cut looks like.
    expect(patterned.volume).toBeGreaterThan(solid.volume * 0.2);
  });

  it('leaves the piece untouched when the option is off', () => {
    const base = slotted();
    const a = measure(withPattern(base, false));
    const b = measure({ ...base, wallPattern: { enabled: true, pattern: 'honeycomb' } });
    expect(a.volume).toBeCloseTo(b.volume, 6);
  });

  it('still produces every piece for an interlocking both-axes bin', () => {
    const base = slotted({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
    });
    const solid = measure(withPattern(base, false));
    const patterned = measure(withPattern(base, true));
    expect(patterned.count).toBe(solid.count);
    expect(patterned.count).toBeGreaterThan(1);
    expect(patterned.volume).toBeLessThan(solid.volume);
  });

  it('leaves a short piece alone rather than destroying it', () => {
    // A 1-unit deep bin gives a piece with very little length to work with; the
    // pattern must degrade to "no pattern", never to a missing or hollow piece.
    const base = slotted({ depth: 1, height: 2 });
    const solid = measure(withPattern(base, false));
    const patterned = measure(withPattern(base, true));
    expect(patterned.count).toBe(solid.count);
    expect(patterned.volume).toBeGreaterThan(0);
    expect(patterned.volume).toBeLessThanOrEqual(solid.volume);
  });
});
