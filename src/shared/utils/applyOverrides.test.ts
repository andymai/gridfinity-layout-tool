import { describe, it, expect } from 'vitest';
import { applyOverrides } from './applyOverrides';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { DesignOverrides } from '@/shared/types/designOverrides';

function cutout(id: string, over: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'circle',
    x: 10,
    y: 10,
    width: 6.35,
    depth: 6.35,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...over,
  };
}

function parent(cutouts: Cutout[] = [cutout('bit')]): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 6, cutouts };
}

describe('applyOverrides', () => {
  it('returns the parent untouched when nothing is claimed', () => {
    const p = parent();
    const { params, orphans } = applyOverrides(p, undefined);
    expect(params).toBe(p);
    expect(orphans).toEqual([]);
  });

  it('applies a claimed top-level dimension', () => {
    const { params } = applyOverrides(parent(), { dimensions: { width: 4 } });
    expect(params.width).toBe(4);
    // Everything unclaimed still comes from the parent.
    expect(params.depth).toBe(2);
  });

  it('applies a claimed cutout size by id', () => {
    const { params } = applyOverrides(parent(), { cutouts: { bit: { width: 12.7 } } });
    expect(params.cutouts?.[0].width).toBe(12.7);
  });

  // The router-bit case from the issue, and the reason PR #3872 is a dependency:
  // a corner-anchored resize turns a size override into a position change and
  // slides the pocket off the center the parent placed it on.
  it('holds a cutout’s center when its size is overridden', () => {
    const { params } = applyOverrides(parent(), {
      cutouts: { bit: { width: 12.7, depth: 12.7 } },
    });

    const result = params.cutouts?.[0];
    // Parent center is 10 + 6.35/2 = 13.175; a 12.7 pocket starts at 6.825.
    expect(result?.x).toBeCloseTo(6.825, 6);
    expect(result?.y).toBeCloseTo(6.825, 6);
    expect(result?.width).toBe(12.7);
  });

  it('leaves cutouts the variant has not claimed alone', () => {
    const { params } = applyOverrides(parent([cutout('a'), cutout('b', { x: 40 })]), {
      cutouts: { a: { width: 12.7 } },
    });

    expect(params.cutouts?.[0].width).toBe(12.7);
    expect(params.cutouts?.[1].width).toBe(6.35);
    expect(params.cutouts?.[1].x).toBe(40);
  });

  it('applies clearance, cut depth and chamfer', () => {
    const { params } = applyOverrides(parent(), {
      cutouts: { bit: { clearance: 0.4, cutDepth: 15, chamferWidth: 0.8 } },
    });

    const result = params.cutouts?.[0];
    expect(result?.clearance).toBe(0.4);
    expect(result?.cutDepth).toBe(15);
    expect(result?.chamferWidth).toBe(0.8);
  });

  // The upstream deletion may itself be undone, so the override is reported,
  // not discarded.
  it('reports an override naming a cutout the parent no longer has', () => {
    const { params, orphans } = applyOverrides(parent([cutout('kept')]), {
      cutouts: { kept: { width: 8 }, deleted: { width: 12.7 } },
    });

    expect(params.cutouts?.[0].width).toBe(8);
    expect(orphans).toEqual([{ cutoutId: 'deleted', override: { width: 12.7 } }]);
  });

  // This is the property that keeps a materialized variant honest: everything
  // the override schema does NOT name must come from the parent, every time.
  it('is lossless for every field the overrides do not name', () => {
    const upstream: BinParams = {
      ...parent([cutout('bit', { rotation: 45, label: 'engraved' })]),
      height: 9,
      wallThickness: 1.6,
      style: 'solid',
    };

    const { params } = applyOverrides(upstream, { cutouts: { bit: { width: 12.7 } } });

    // Sampled across the record, not just the neighbours of what changed.
    expect(params.height).toBe(9);
    expect(params.wallThickness).toBe(1.6);
    expect(params.scoop).toEqual(upstream.scoop);
    expect(params.style).toBe('solid');
    expect(params.base).toEqual(upstream.base);
    expect(params.compartments).toEqual(upstream.compartments);
    expect(params.cutouts?.[0].rotation).toBe(45);
    expect(params.cutouts?.[0].label).toBe('engraved');
    expect(params.cutouts?.[0].cutDepth).toBe(10);
  });

  it('does not mutate the parent it was given', () => {
    const p = parent();
    const before = JSON.stringify(p);

    applyOverrides(p, { dimensions: { width: 4 }, cutouts: { bit: { width: 12.7 } } });

    expect(JSON.stringify(p)).toBe(before);
  });

  it('is deterministic', () => {
    const p = parent();
    const overrides: DesignOverrides = {
      dimensions: { height: 12 },
      cutouts: { bit: { width: 9 } },
    };

    expect(applyOverrides(p, overrides).params).toEqual(applyOverrides(p, overrides).params);
  });

  it('survives a parent with no cutouts at all', () => {
    const { params, orphans } = applyOverrides(
      { ...DEFAULT_BIN_PARAMS, cutouts: [] },
      {
        cutouts: { gone: { width: 4 } },
      }
    );

    expect(params.cutouts).toEqual([]);
    expect(orphans).toHaveLength(1);
  });
});
