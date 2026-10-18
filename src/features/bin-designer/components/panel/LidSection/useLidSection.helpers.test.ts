import { describe, it, expect } from 'vitest';
import {
  buildBlockerReason,
  computeRailSummary,
  fixableIdsFor,
  lidValueSummary,
} from './useLidSection.helpers';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import type { LabelTabFootprint } from '@/shared/utils/labelTabPlan';
import { DEFAULT_LID_CONFIG, type LidClickRails } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type {
  LidCompatibilityIssue,
  LidCompatibilitySide,
} from '@/features/bin-designer/utils/lidCompatibility';
import type { useTranslation } from '@/i18n';

// Identity translator: returns the key so assertions can pin the chosen branch.
const t: ReturnType<typeof useTranslation> = (key: string) => key;

const GRID = 42;
const ALL_RAILS: LidClickRails = { front: true, back: true, left: true, right: true };
const NO_DISABLED: ReadonlySet<LidCompatibilitySide> = new Set();

describe('computeRailSummary', () => {
  // Since the worker cuts a wall's run around the label tabs, so the
  // summary has to do the same or it advertises rails that are not built.
  const backTab = (xMin: number, xMax: number): LabelTabFootprint => ({
    anchor: 'back',
    xMin,
    xMax,
    // Bin depth 3 -> innerD/2 is ~61.5; a 12mm tab hangs off the back wall.
    yMin: 49.5,
    yMax: 61.5,
    zMin: 20,
    zMax: 36,
  });

  it('drops the back rail when a full-width tab takes that wall', () => {
    const plain = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS);
    const tabbed = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS, GRID, [
      backTab(-40, 40),
    ]);
    expect(tabbed.count).toBe(plain.count - 1);
  });

  it('counts a rail either side of a narrow tab', () => {
    const tabbed = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS, GRID, [
      backTab(-10, 10),
    ]);
    const plain = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS);
    // The back wall's one rail becomes two shorter ones.
    expect(tabbed.count).toBe(plain.count + 1);
  });

  it('shortens the side rails a back tab reaches into', () => {
    const plain = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS);
    const tabbed = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS, GRID, [
      backTab(-40, 40),
    ]);
    // Longest surviving rail is a side one, now clipped short of the tab.
    expect(tabbed.lengths[0]).toBeLessThan(plain.lengths[0]);
  });

  it('reports both axis lengths for a full-coverage rectangle with every rail on', () => {
    // lidCornerR = LID_CORNER_RADIUS(4) - LID_FIT_CLEARANCE(0.25) = 3.75.
    // railLenX = (2*42 - 0.5 - 7.5) = 76; railLenY = (3*42 - 0.5 - 7.5) = 118.
    const summary = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, ALL_RAILS);
    expect(summary.count).toBe(4);
    expect(summary.lengths).toEqual([118, 118, 76, 76]);
    expect(summary.polygonRange).toBeUndefined();
  });

  it('counts only the walls whose rail toggle is on', () => {
    const frontOnly: LidClickRails = { front: true, back: false, left: false, right: false };
    const summary = computeRailSummary(2, 3, GRID, 100, NO_DISABLED, undefined, frontOnly);
    expect(summary.count).toBe(1);
    expect(summary.lengths).toEqual([76]);
  });

  it('drops sides flagged in disabledRails', () => {
    const disabled: ReadonlySet<LidCompatibilitySide> = new Set(['front']);
    const summary = computeRailSummary(2, 3, GRID, 100, disabled, undefined, ALL_RAILS);
    expect(summary.count).toBe(3);
    expect(summary.lengths).toEqual([118, 118, 76]);
  });

  it('scales rail length by the coverage percent', () => {
    const summary = computeRailSummary(2, 2, GRID, 50, NO_DISABLED, undefined, ALL_RAILS);
    // (2*42 - 0.5 - 7.5) * 0.5 = 38 on both axes.
    expect(summary.count).toBe(4);
    expect(summary.lengths).toEqual([38, 38, 38, 38]);
  });

  it('excludes walls whose scaled length is below the minimum rail length', () => {
    // railLenX = (1*42 - 0.5 - 7.5) * 0.05 = 1.7 < LID_MIN_RAIL_LENGTH(4).
    const summary = computeRailSummary(1, 1, GRID, 5, NO_DISABLED, undefined, ALL_RAILS);
    expect(summary.count).toBe(0);
    expect(summary.lengths).toEqual([]);
  });

  it('returns a coherent polygon range for a partial (L-shaped) mask', () => {
    // 2u x 2u grid (4x4 half-bin cells) with the top-right 1u quadrant removed.
    const cells = new Array<0 | 1>(16).fill(1);
    for (const index of [10, 11, 14, 15]) cells[index] = 0;
    const mask: CellMask = { cols: 4, rows: 4, cells };
    const summary = computeRailSummary(2, 2, GRID, 100, NO_DISABLED, mask, ALL_RAILS);
    expect(summary.count).toBeGreaterThan(0);
    expect(summary.polygonRange).toBeDefined();
    const range = summary.polygonRange;
    if (!range) throw new Error('expected polygonRange');
    expect(range.min).toBeLessThanOrEqual(range.max);
    expect(summary.lengths.length).toBe(summary.count);
    expect(summary.lengths[0]).toBe(range.max);
    expect(summary.lengths[summary.lengths.length - 1]).toBe(range.min);
    // Sorted descending.
    const descending = [...summary.lengths].sort((a, b) => b - a);
    expect(summary.lengths).toEqual(descending);
  });
});

describe('lidValueSummary', () => {
  it('maps friction attachment to the friction key', () => {
    expect(lidValueSummary({ ...DEFAULT_LID_CONFIG, attachment: 'friction' }, t)).toBe(
      'binDesigner.lid.summaryFriction'
    );
  });

  it('maps magnetic attachment to the magnetic key', () => {
    expect(lidValueSummary({ ...DEFAULT_LID_CONFIG, attachment: 'magnetic' }, t)).toBe(
      'binDesigner.lid.summaryMagnetic'
    );
  });

  it('reports no rails when a click-rail lid has every side off', () => {
    const lid = {
      ...DEFAULT_LID_CONFIG,
      attachment: 'clickRails' as const,
      clickRails: { front: false, back: false, left: false, right: false },
    };
    expect(lidValueSummary(lid, t)).toBe('binDesigner.lid.summaryNoRails');
  });

  it('reports partial rails for a click-rail lid with some sides off', () => {
    const lid = {
      ...DEFAULT_LID_CONFIG,
      attachment: 'clickRails' as const,
      clickRails: { front: true, back: true, left: false, right: false },
    };
    expect(lidValueSummary(lid, t)).toBe('binDesigner.lid.summaryPartialRails');
  });

  it('reports full coverage for a click-rail lid with every side on', () => {
    const lid = {
      ...DEFAULT_LID_CONFIG,
      attachment: 'clickRails' as const,
      clickRails: ALL_RAILS,
    };
    expect(lidValueSummary(lid, t)).toBe('binDesigner.lid.summary');
  });
});

describe('buildBlockerReason', () => {
  const issue = (id: LidCompatibilityIssue['id']): LidCompatibilityIssue => ({
    id,
    severity: 'blocker',
  });

  it('returns null when there are no blockers', () => {
    expect(buildBlockerReason([], t)).toBeNull();
  });

  it('returns the single-blocker key for exactly one blocker', () => {
    expect(buildBlockerReason([issue('wallCutouts')], t)).toBe(
      'binDesigner.lid.compat.disabledOne'
    );
  });

  it('states the slant rather than a fix for a slanted bin', () => {
    expect(buildBlockerReason([issue('slanted')], t)).toBe('binDesigner.lid.compat.slanted');
  });

  it('returns the many-blockers key for multiple blockers', () => {
    expect(buildBlockerReason([issue('wallCutouts'), issue('handles')], t)).toBe(
      'binDesigner.lid.compat.disabledMany'
    );
  });
});

describe('fixableIdsFor', () => {
  /** A 1x2x5 solid bin filled to the rim, with one pocket `cutDepth` deep. */
  const solidWithPocket = (cutDepth: number, pocket: Partial<Cutout> = {}): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 2,
    height: 5,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [
      {
        id: 'pocket',
        shape: 'circle',
        x: 5,
        y: 25,
        width: 20,
        depth: 20,
        cutDepth,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
        ...pocket,
      },
    ],
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'slide',
      slide: DEFAULT_LID_SLIDE_CONFIG,
    },
  });

  it('offers to lower the fill when every pocket keeps its depth', () => {
    expect(fixableIdsFor(solidWithPocket(10)).has('slideFillTooHigh')).toBe(true);
  });

  it('withholds the fill fix when it would leave a pocket short of its depth', () => {
    const ids = fixableIdsFor(solidWithPocket(25));
    expect(ids.has('slideFillTooHigh')).toBe(false);
    expect(ids.has('slideFlushNeedsNoLip')).toBe(true);
  });

  // The fix lowers the fill to 21.75mm. A mesh imprint is bounded from the
  // print's bottom, so it can reach the socket and keeps 26.5mm.
  it.each<[string, Partial<Cutout>, number, number]>([
    ['a mesh imprint', { shape: 'mesh' }, 28, 25],
    ['a pocket hanging off the board', { x: -10 }, 25, 10],
    // A 45° lean tips the far end of a 40mm-long floor 14.1mm lower: 20mm
    // drawn reaches 28.3mm, 8mm only 19.8mm.
    ['a leaned pocket', { x: -1, width: 20, depth: 40, leanDeg: 45 }, 20, 8],
    // Clearance grows the profile before the lean: 20.5mm drawn reaches 21.6mm
    // on the nominal 20mm circle, 22.3mm on the cleared 22mm one.
    [
      'a leaned pocket with insertion clearance',
      { shape: 'circle', clearance: 2, leanDeg: 45 },
      20.5,
      18,
    ],
    // A path is offset by its clearance on every edge: 19mm drawn reaches
    // 21.2mm on a 22mm profile, 21.9mm on the 24mm one the worker cuts.
    [
      'a leaned path with insertion clearance',
      {
        shape: 'path',
        clearance: 2,
        leanDeg: 45,
        path: [
          { x: 5, y: 25, handleIn: null, handleOut: null, symmetric: false },
          { x: 25, y: 25, handleIn: null, handleOut: null, symmetric: false },
          { x: 25, y: 45, handleIn: null, handleOut: null, symmetric: false },
          { x: 5, y: 45, handleIn: null, handleOut: null, symmetric: false },
        ],
      },
      19,
      16,
    ],
    // Every copy is clamped to the fill at its drawn depth, whatever the lean:
    // these 10mm copies tip only to 21.2mm, inside the lowered fill, but 25mm
    // drawn still loses 3.25mm.
    [
      'a leaned repeat',
      {
        width: 10,
        depth: 10,
        leanDeg: 45,
        array: {
          mode: 'grid',
          cols: 1,
          rows: 2,
          pitchX: 0,
          pitchY: 55,
          count: 1,
          radius: 0,
          startAngle: 0,
          rotateToCenter: false,
        },
      },
      25,
      15,
    ],
  ])('withholds the fill fix only when it would cut %s short', (_, pocket, deep, kept) => {
    expect(fixableIdsFor(solidWithPocket(deep, pocket)).has('slideFillTooHigh')).toBe(false);
    expect(fixableIdsFor(solidWithPocket(kept, pocket)).has('slideFillTooHigh')).toBe(true);
  });

  it('measures a leaned path by the mitered outline the worker cuts', () => {
    // A 20mm triangle pointing at -Y: its 2mm clearance miters the tip out to
    // 14.5mm from the centre, so 18mm drawn reaches 23mm, past the fill.
    const triangle = (cutDepth: number): BinParams =>
      solidWithPocket(cutDepth, {
        shape: 'path',
        clearance: 2,
        leanDeg: 45,
        path: [
          { x: 15, y: 25, handleIn: null, handleOut: null, symmetric: false },
          { x: 25, y: 45, handleIn: null, handleOut: null, symmetric: false },
          { x: 5, y: 45, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
    expect(fixableIdsFor(triangle(18)).has('slideFillTooHigh')).toBe(false);
    expect(fixableIdsFor(triangle(12)).has('slideFillTooHigh')).toBe(true);
  });

  it('tips a leaned floor along the tilt axis only', () => {
    // 15mm drawn across a 39mm-wide, 10mm-deep pocket reaches 14.1mm; reading
    // the width as the tilted span would put it at 24.4mm.
    const wide = solidWithPocket(15, { x: 0, width: 39, depth: 10, leanDeg: 45 });
    expect(fixableIdsFor(wide).has('slideFillTooHigh')).toBe(true);
  });

  it('withholds the fill fix on a tapered bin, whose wall narrows with depth', () => {
    const tapered: BinParams = {
      ...solidWithPocket(5),
      overhang: {
        enabled: true,
        left: 10,
        right: 0,
        front: 0,
        back: 0,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: 20,
          left: 10,
          right: 0,
          front: 0,
          back: 0,
        },
      },
    };
    expect(fixableIdsFor(tapered).has('slideFillTooHigh')).toBe(false);
  });
});
