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
