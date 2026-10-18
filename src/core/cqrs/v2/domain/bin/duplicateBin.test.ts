import { describe, it, expect, vi } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { layerId, gridUnits } from '@/core/types';
import type * as PosthogModule from '@/shared/analytics/posthog';
import { duplicateBin } from './duplicateBin';
import { makeLayout, makeBin } from './_testHelpers';

// trackBinCreated is a side-effecting analytics call. Stub it so tests
// don't try to dispatch to PostHog.
vi.mock('@/shared/analytics/posthog', async () => {
  const actual = await vi.importActual<typeof PosthogModule>('@/shared/analytics/posthog');
  return {
    ...actual,
    trackBinCreated: vi.fn(),
  };
});

describe('v2 bin.duplicate', () => {
  it('places the duplicate to the right when there is room', () => {
    const source = makeBin('bin_src', { x: gridUnits(0), y: gridUnits(0) });
    const layout = makeLayout({ bins: [source] });

    const result = duplicateBin.handle({ id: 'bin_src' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.newBin.x).toBe(gridUnits(1));
    expect(result.value.event.payload.newBin.y).toBe(gridUnits(0));
    expect(result.value.event.payload.newBin.layerId).toBe(layerId('layer_1'));
    expect(result.value.event.payload.sourceId).toBe(source.id);
  });

  // The copy keeps the overhang, which keeps it upright, so the check must too.
  it('places a copy whose overhang keeps it upright beside the source', () => {
    const source = makeBin('bin_1', {
      y: gridUnits(3),
      slant: { angleDeg: 40, side: 'back', endSupport: true },
      overhang: { left: 0, right: 0, front: 0, back: 5 },
    });
    const layout = makeLayout({ bins: [source] });
    const result = duplicateBin.handle({ id: 'bin_1' }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.newBin.layerId).not.toBe(STAGING_ID);
  });

  it('falls back to staging when no adjacent placement fits', () => {
    // Fill all four cardinal slots around the source bin so the search exhausts.
    const source = makeBin('bin_src', { x: gridUnits(2), y: gridUnits(2) });
    const right = makeBin('bin_right', { x: gridUnits(3), y: gridUnits(2) });
    const left = makeBin('bin_left', { x: gridUnits(1), y: gridUnits(2) });
    const above = makeBin('bin_above', { x: gridUnits(2), y: gridUnits(3) });
    const below = makeBin('bin_below', { x: gridUnits(2), y: gridUnits(1) });
    const layout = makeLayout({ bins: [source, right, left, above, below] });

    const result = duplicateBin.handle({ id: 'bin_src' }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.newBin.layerId).toBe(STAGING_ID);
    expect(result.value.event.payload.newBin.x).toBe(gridUnits(0));
    expect(result.value.event.payload.newBin.y).toBe(gridUnits(0));
  });

  it('duplicates a staging bin into staging at (0, 0)', () => {
    const source = makeBin('bin_src', { layerId: STAGING_ID });
    const layout = makeLayout({ bins: [source] });

    const result = duplicateBin.handle({ id: 'bin_src' }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.newBin.layerId).toBe(STAGING_ID);
  });

  it('errors when the source bin does not exist', () => {
    const layout = makeLayout();
    const result = duplicateBin.handle({ id: 'bin_gone' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('leaves the copy unlocked, and the label it carries over intact', () => {
    const source = makeBin('bin_src', { locked: true, label: 'M3 screws' });
    const layout = makeLayout({ bins: [source] });

    const result = duplicateBin.handle({ id: 'bin_src' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const copy = result.value.event.payload.newBin;
    expect(copy.locked).toBeUndefined();
    expect(copy.label).toBe('M3 screws');
  });

  it('apply() round-trip: applying the event pushes the resolved newBin', () => {
    const source = makeBin('bin_src');
    const layout = makeLayout({ bins: [source] });
    const result = duplicateBin.handle({ id: 'bin_src' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      duplicateBin.apply({ type: 'bin.duplicated', payload: result.value.event.payload }, draft);
    });

    expect(applied.bins).toHaveLength(2);
    expect(applied.bins[1]).toEqual(result.value.event.payload.newBin);
  });
});
