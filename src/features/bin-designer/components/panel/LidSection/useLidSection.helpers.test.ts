import { describe, it, expect } from 'vitest';
import { buildBlockerReason, computeRailSummary, lidValueSummary } from './useLidSection.helpers';
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

  it('returns the many-blockers key for multiple blockers', () => {
    expect(buildBlockerReason([issue('wallCutouts'), issue('handles')], t)).toBe(
      'binDesigner.lid.compat.disabledMany'
    );
  });
});
