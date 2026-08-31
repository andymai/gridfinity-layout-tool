import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { buildDividerPiece, buildUniqueDividerPieces } from './dividerBuilder';
import { box, cut, fuseAll } from 'brepjs';

// Mock brepjs — dividerBuilder imports it at module level.
// Vitest hoists vi.mock calls above imports automatically.
// Each mock shape has a delete() stub so disposal calls succeed in tests.
vi.mock('brepjs', () => {
  const makeShape = () => ({ delete: vi.fn() });
  return {
    box: vi.fn(() => makeShape()),
    translate: vi.fn(() => makeShape()),
    cut: vi.fn(() => makeShape()),
    fuseAll: vi.fn(() => makeShape()),
    unwrap: vi.fn((v: unknown) => v),
  };
});

function makeSlottedParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildDividerPiece', () => {
  it('creates a divider piece with correct dimensions', () => {
    const result = buildDividerPiece(80, 1.2, 20);
    expect(result).toBeDefined();
  });
});

describe('buildUniqueDividerPieces', () => {
  it('returns empty for non-slotted style', () => {
    const params = makeSlottedParams({ style: 'standard' });
    expect(buildUniqueDividerPieces(params, 80, 80, 30, false)).toEqual([]);
  });

  it('returns one piece when only X-axis is enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: false, pitch: 40 },
      },
    });
    const pieces = buildUniqueDividerPieces(params, 80, 80, 30, false);
    expect(pieces).toHaveLength(1);
  });

  it('returns two pieces when both axes are enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
    });
    const pieces = buildUniqueDividerPieces(params, 80, 80, 30, false);
    expect(pieces).toHaveLength(2);
  });

  it('cuts no cross-lap notches when a single axis is enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: false, pitch: 40 },
      },
    });
    buildUniqueDividerPieces(params, 80, 80, 30, false);
    // The one cut is the tab neck relief; a single-axis piece carries no
    // cross-lap notch, so there is no second (notch) cut.
    expect(cut).toHaveBeenCalledTimes(1);
  });

  it('cuts cross-lap notches into both pieces when both axes are enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
    });
    buildUniqueDividerPieces(params, 80, 80, 30, false);
    // 80mm interior at 40mm pitch → 2 compartments → 1 crossing per piece.
    // Per piece: one notch cut + one neck-relief cut → 4 cuts across both.
    expect(cut).toHaveBeenCalledTimes(4);
    // The single notch cutter is used directly (no fuse), but each piece's
    // neck relief fuses its four cutters → one fuse per piece.
    expect(fuseAll).toHaveBeenCalledTimes(2);
  });

  it('notches X pieces from the top and Y pieces from the bottom', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
      dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
    });
    buildUniqueDividerPieces(params, 80, 80, 30, false);

    // The two cross-lap notch cutters are the only boxes reaching just past
    // mid-height (Y-dim ≈ h/2); piece bodies are Y=30 and neck-relief cutters
    // are shallow, so filter by that depth rather than a fixed call index.
    const calls = vi.mocked(box).mock.calls;
    const notchCutters = calls.filter((c) => c[1] > 15 && c[1] < 15.5);
    expect(notchCutters).toHaveLength(2);

    // First piece is X (notched from the top), second is Y (from the bottom).
    const xCutterAt = (notchCutters[0][3] as { at: [number, number, number] }).at;
    const yCutterAt = (notchCutters[1][3] as { at: [number, number, number] }).at;
    // dividerHeight = wallHeight (30, no lip); notch centers mirror across mid-height
    expect(xCutterAt[1]).toBeGreaterThan(0);
    expect(yCutterAt[1]).toBeLessThan(0);
    expect(xCutterAt[1]).toBeCloseTo(-yCutterAt[1], 5);

    // Notch opening matches the wall slot width (thickness + 2×clearance)
    expect(notchCutters[0][0]).toBeCloseTo(1.6 + 2 * 0.25, 5);
    // Notch reaches just past half height: depth = h/2 + clearance (+overlap)
    const notchCutterDepth = notchCutters[0][1];
    expect(notchCutterDepth).toBeGreaterThan(15);
    expect(notchCutterDepth).toBeLessThan(15.5);
  });

  it('fuses notch cutters when a piece has multiple crossings', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 20 },
      },
    });
    // 80mm at 20mm pitch → 4 compartments → 3 crossings on the X piece
    buildUniqueDividerPieces(params, 80, 80, 30, false);
    // Fuses: X-piece 3-notch compound, then each piece's 4-cutter neck relief.
    expect(fuseAll).toHaveBeenCalledTimes(3);
    // The first fuse is still the X piece's notch compound (3 crossings).
    expect(vi.mocked(fuseAll).mock.calls[0][0]).toHaveLength(3);
  });

  it('labels full-length pieces by axis', () => {
    const params = makeSlottedParams({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
    });
    const pieces = buildUniqueDividerPieces(params, 80, 80, 30, false);
    expect(pieces.map((p) => p.label)).toEqual(['divider-horizontal', 'divider-vertical']);
  });

  describe('insert mode', () => {
    const insertParams = (overrides: Partial<BinParams> = {}): BinParams =>
      makeSlottedParams({
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
          crossStyle: 'insert',
          longAxis: 'y',
        },
        dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
        ...overrides,
      });

    it('emits a grooved long piece plus interior and edge short pieces', () => {
      const pieces = buildUniqueDividerPieces(insertParams(), 80, 60, 30, false);
      expect(pieces.map((p) => p.label)).toEqual([
        'divider-vertical',
        'divider-horizontal-compartment',
        'divider-horizontal-compartment-edge',
      ]);
      // Grooves sit at the short-axis positions along the long piece
      // (innerD=60 at 20mm x-pitch → 2 positions), cut into both faces
      // → 4 cutters fused as the first boolean cut. Then the wall-tab pieces
      // take a neck-relief cut: long piece (+1) and edge piece (+1); the
      // interior piece seats in receptacles only, so it is not relieved.
      expect(cut).toHaveBeenCalledTimes(3);
      expect(vi.mocked(fuseAll).mock.calls[0][0]).toHaveLength(4);
    });

    it('short pieces are shorter than the full span', () => {
      buildUniqueDividerPieces(insertParams(), 80, 60, 30, false);
      const boxCalls = vi.mocked(box).mock.calls;
      // Piece boxes (skip groove cutters, which have cutterHeight > height):
      // interior span = 20 − 1.6 = 18.4 plus two receptacle tabs (0.3 min
      // each) → 19.0; edge span = 20 − 0.8 = 19.2 plus wall+receptacle tabs
      const pieceLengths = boxCalls.filter((c) => c[1] === 30).map((c) => c[0]);
      expect(pieceLengths.length).toBe(3);
      expect(pieceLengths[1]).toBeCloseTo(19.0, 5);
      expect(pieceLengths[2]).toBeCloseTo(19.8, 5);
    });

    it('falls back to cross-lap when the divider is too thin for receptacles', () => {
      const params = insertParams({
        dividerPieces: { height: 'auto', thickness: 1.0, clearance: 0.25 },
      });
      const pieces = buildUniqueDividerPieces(params, 80, 60, 30, false);
      expect(pieces.map((p) => p.label)).toEqual(['divider-horizontal', 'divider-vertical']);
      // Each piece takes a cross-lap notch cut plus a neck-relief cut → 4 cuts.
      expect(cut).toHaveBeenCalledTimes(4);
    });

    it('emits only the long piece when the short axis has no rows', () => {
      const params = insertParams({
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 50 },
          y: { enabled: true, pitch: 20 },
          crossStyle: 'insert',
          longAxis: 'y',
        },
      });
      // innerD=40 at x-pitch 50 → 0 rows → no grooves, no short pieces
      const pieces = buildUniqueDividerPieces(params, 80, 40, 30, false);
      expect(pieces.map((p) => p.label)).toEqual(['divider-vertical']);
      // No grooves, but the lone long piece still takes its neck-relief cut.
      expect(cut).toHaveBeenCalledTimes(1);
    });

    it('falls back to cross-lap when the long axis has no dividers', () => {
      const params = insertParams({
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 50 },
          crossStyle: 'insert',
          longAxis: 'y',
        },
      });
      // innerW=40 at pitch 50 → 1 compartment → 0 long dividers
      const pieces = buildUniqueDividerPieces(params, 40, 60, 30, false);
      expect(pieces.map((p) => p.label)).toEqual(['divider-horizontal', 'divider-vertical']);
    });
  });

  describe('lap partial styles', () => {
    const lapParams = (partialStyle: 'snappable' | 'lengthSet'): BinParams =>
      makeSlottedParams({
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 40 },
          y: { enabled: true, pitch: 40 },
          crossStyle: 'lap',
          partialStyle,
        },
        dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
      });

    it('scores both full pieces at snap positions in snappable mode', () => {
      // 80mm at 40mm pitch → 1 crossing per axis → 1 notch + 1 snap score
      // per piece. The score cuts both faces → 2 groove cutters fused per piece.
      buildUniqueDividerPieces(lapParams('snappable'), 80, 80, 30, false);
      const fuseArgLengths = vi.mocked(fuseAll).mock.calls.map((c) => c[0].length);
      // Per piece: a 2-cutter score compound, then a 4-cutter neck-relief
      // compound → [2, 4] repeated for the two pieces.
      expect(fuseArgLengths).toEqual([2, 4, 2, 4]);
      // Two pieces are still emitted (not a family)
    });

    it('still emits exactly the two full pieces in snappable mode', () => {
      const pieces = buildUniqueDividerPieces(lapParams('snappable'), 80, 80, 30, false);
      expect(pieces.map((p) => p.label)).toEqual(['divider-horizontal', 'divider-vertical']);
    });

    it('emits a labeled family per axis in lengthSet mode', () => {
      // 80mm at 40mm pitch → 2 compartments, 1 crossing per axis.
      // Per axis: full ('') + edge 1u (interior mid needs ≥2 dividers → none).
      const pieces = buildUniqueDividerPieces(lapParams('lengthSet'), 80, 80, 30, false);
      expect(pieces.map((p) => p.label)).toEqual([
        'divider-horizontal',
        'divider-horizontal-1u',
        'divider-vertical',
        'divider-vertical-1u',
      ]);
    });

    it('emits interior mid pieces once there are enough crossings', () => {
      const params = makeSlottedParams({
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
          crossStyle: 'lap',
          partialStyle: 'lengthSet',
        },
        dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
      });
      // 80mm at 20mm pitch → 4 compartments, 3 crossings per axis.
      const pieces = buildUniqueDividerPieces(params, 80, 80, 30, false);
      const xLabels = pieces.map((p) => p.label).filter((l) => l.startsWith('divider-horizontal'));
      expect(xLabels).toEqual([
        'divider-horizontal',
        'divider-horizontal-1u',
        'divider-horizontal-2u',
        'divider-horizontal-3u',
        'divider-horizontal-1u-mid',
        'divider-horizontal-2u-mid',
      ]);
    });

    it('ignores partialStyle when insert mode is active (no cross-spanning)', () => {
      const params = makeSlottedParams({
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
          crossStyle: 'insert',
          longAxis: 'y',
          partialStyle: 'lengthSet',
        },
        dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
      });
      const pieces = buildUniqueDividerPieces(params, 80, 60, 30, false);
      // Insert topology stands — grooved long piece + per-compartment shorts
      expect(pieces.map((p) => p.label)).toEqual([
        'divider-vertical',
        'divider-horizontal-compartment',
        'divider-horizontal-compartment-edge',
      ]);
    });
  });
});
