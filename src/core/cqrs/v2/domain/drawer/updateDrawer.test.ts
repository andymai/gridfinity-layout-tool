import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits } from '@/core/types';
import { updateDrawer } from './updateDrawer';
import { makeLayout, makeBin } from './_testHelpers';
import { applyEvent } from '../../../projection/replay';

describe('v2 drawer.update', () => {
  it('clamps width to GRID_MAX', () => {
    const layout = makeLayout();
    const result = updateDrawer.handle({ width: 9999 }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.width).toBe(gridUnits(CONSTRAINTS.GRID_MAX));
  });

  it('clamps height to >= total layer height', () => {
    const layout = makeLayout({
      layers: [
        { id: 'layer_1' as never, name: 'L1', height: heightUnits(3) },
        { id: 'layer_2' as never, name: 'L2', height: heightUnits(3) },
      ],
    });
    const result = updateDrawer.handle({ height: 1 }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    // Total layer height = 6, requested = 1, clamped up to 6.
    expect(result.value.event.payload.changes.height).toBe(heightUnits(6));
  });

  it('captures displacedBinIds when shrinking the drawer', () => {
    // Drawer is 6x4. Bin at (5, 0) with size 1x1 fits. Shrink to 4x4 — bin
    // is now out of bounds and should be in displacedBinIds.
    const layout = makeLayout({ bins: [makeBin('bin_a', 5, 0), makeBin('bin_b', 0, 0)] });
    const result = updateDrawer.handle({ width: 4 }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.displacedBinIds).toEqual([binId('bin_a')]);
    expect(result.value.event.payload.binsDisplacedToStaging).toBe(1);
  });

  it('does not displace bins already in staging', () => {
    const stagingBin = makeBin('bin_s', 99, 99, STAGING_ID);
    const layout = makeLayout({ bins: [stagingBin] });
    const result = updateDrawer.handle({ width: 1 }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.displacedBinIds).toEqual([]);
  });

  it('apply() updates drawer AND moves displaced bins to STAGING_ID', () => {
    const layout = makeLayout({ bins: [makeBin('bin_a', 5, 0), makeBin('bin_b', 0, 0)] });
    const result = updateDrawer.handle({ width: 4 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      updateDrawer.apply({ type: 'drawer.updated', payload: result.value.event.payload }, draft);
    });

    expect(applied.drawer.width).toBe(gridUnits(4));
    expect(applied.bins.find((b) => b.id === binId('bin_a'))?.layerId).toBe(STAGING_ID);
    expect(applied.bins.find((b) => b.id === binId('bin_b'))?.layerId).not.toBe(STAGING_ID);
  });
});

describe('v2 drawer.update with an outline', () => {
  const U = 42;
  const L_OUTLINE = {
    vertices: [
      { x: 0, y: 0 },
      { x: 6 * U, y: 0 },
      { x: 6 * U, y: 2 * U },
      { x: 4 * U, y: 2 * U },
      { x: 4 * U, y: 4 * U },
      { x: 0, y: 4 * U },
    ],
  };
  const withOutline = () => {
    const base = makeLayout();
    return { ...base, drawer: { ...base.drawer, outline: L_OUTLINE } };
  };

  it('crops the outline on shrink and records it in changes', () => {
    const result = updateDrawer.handle({ width: 5 }, { aggregate: withOutline() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const changes = result.value.event.payload.changes;
    expect(changes.outline).toBeDefined();
    expect(changes.outline?.vertices.every((v) => v.x <= 5 * U + 0.01)).toBe(true);
    expect(result.value.event.payload.previous.outline).toBe(L_OUTLINE);
  });

  it('resets to a plain rectangle when the shrink consumes the notch', () => {
    // Shrinking to width 4 removes everything right of the notch — the
    // remaining region is the full 4×4 rectangle.
    const result = updateDrawer.handle({ width: 4 }, { aggregate: withOutline() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const payload = result.value.event.payload;
    expect('outline' in payload.changes).toBe(true);
    expect(payload.changes.outline).toBeUndefined();

    const next = produce(withOutline(), (draft) => {
      updateDrawer.apply({ payload } as never, draft);
    });
    expect('outline' in next.drawer).toBe(false);
  });

  it('displaces bins that fall outside the adapted outline', () => {
    // Growing depth to 6 extends the shape upward except over the notch;
    // a bin in the notch column stays displaced.
    const layout = { ...withOutline(), bins: [makeBin('bin_notch', 5, 3)] };
    const result = updateDrawer.handle({ depth: 6 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.displacedBinIds).toEqual([binId('bin_notch')]);
  });

  it('replay deletes the outline key on reset, matching apply()', () => {
    const result = updateDrawer.handle({ width: 4 }, { aggregate: withOutline() });
    if (!isOk(result)) throw new Error('handle failed');
    const event = {
      type: 'drawer.updated',
      payload: result.value.event.payload,
    } as never;
    const replayed = applyEvent(withOutline(), event);
    expect('outline' in replayed.drawer).toBe(false);
  });

  it('leaves the outline untouched when only height changes', () => {
    const result = updateDrawer.handle({ height: 9 }, { aggregate: withOutline() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect('outline' in result.value.event.payload.changes).toBe(false);
  });
});
