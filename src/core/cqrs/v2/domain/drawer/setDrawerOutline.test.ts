import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId } from '@/core/types';
import type { DrawerOutline } from '@/core/types';
import { setDrawerOutline } from './setDrawerOutline';
import { makeLayout, makeBin } from './_testHelpers';

const U = 42;

/** 6×4 drawer with the right 2×2 corner (top) notched out. */
const L_OUTLINE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 6 * U, y: 0 },
    { x: 6 * U, y: 2 * U },
    { x: 4 * U, y: 2 * U },
    { x: 4 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

describe('v2 drawer.setOutline', () => {
  it('sets a valid outline and displaces bins outside it', () => {
    // bin_a sits in the notch (5,3); bin_b is in the body.
    const layout = makeLayout({ bins: [makeBin('bin_a', 5, 3), makeBin('bin_b', 0, 0)] });
    const result = setDrawerOutline.handle({ outline: L_OUTLINE }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.outline).toBeDefined();
    expect(result.value.event.payload.previousOutline).toBeUndefined();
    expect(result.value.event.payload.displacedBinIds).toEqual([binId('bin_a')]);
  });

  it('apply() installs the outline and stages displaced bins', () => {
    const layout = makeLayout({ bins: [makeBin('bin_a', 5, 3)] });
    const result = setDrawerOutline.handle({ outline: L_OUTLINE }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const event = { payload: result.value.event.payload } as never;
    const next = produce(layout, (draft) => {
      setDrawerOutline.apply(event, draft);
    });
    expect(next.drawer.outline?.vertices).toHaveLength(6);
    expect(next.bins[0].layerId).toBe(STAGING_ID);
  });

  it('clears the outline with null and records the previous shape for undo', () => {
    const base = makeLayout();
    const withOutline = { ...base, drawer: { ...base.drawer, outline: L_OUTLINE } };
    const result = setDrawerOutline.handle({ outline: null }, { aggregate: withOutline });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.outline).toBeUndefined();
    expect(result.value.event.payload.previousOutline).toBe(L_OUTLINE);

    const event = { payload: result.value.event.payload } as never;
    const next = produce(withOutline, (draft) => {
      setDrawerOutline.apply(event, draft);
    });
    expect('outline' in next.drawer).toBe(false);
  });

  it('normalizes a rectangle-equivalent outline to no outline', () => {
    const rect: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 6 * U, y: 0 },
        { x: 6 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const result = setDrawerOutline.handle({ outline: rect }, { aggregate: makeLayout() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.outline).toBeUndefined();
  });

  it('rejects invalid outlines (self-intersecting)', () => {
    const bowtie: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 6 * U, y: 4 * U },
        { x: 6 * U, y: 0 },
        { x: 0, y: 4 * U },
      ],
    };
    const result = setDrawerOutline.handle({ outline: bowtie }, { aggregate: makeLayout() });
    expect(isOk(result)).toBe(false);
  });

  it('rejects outlines exceeding the drawer extent', () => {
    const tooWide: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10 * U, y: 0 },
        { x: 0, y: 4 * U },
      ],
    };
    const result = setDrawerOutline.handle({ outline: tooWide }, { aggregate: makeLayout() });
    expect(isOk(result)).toBe(false);
  });

  it('snaps near-boundary vertices before validating', () => {
    const nearlySnapped: DrawerOutline = {
      vertices: [
        { x: 0.03, y: -0.02 },
        { x: 6 * U, y: 0 },
        { x: 6 * U, y: 2 * U },
        { x: 4 * U, y: 2 * U },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U + 0.04 },
      ],
    };
    const result = setDrawerOutline.handle({ outline: nearlySnapped }, { aggregate: makeLayout() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.outline?.vertices[0]).toEqual({ x: 0, y: 0 });
  });
});
