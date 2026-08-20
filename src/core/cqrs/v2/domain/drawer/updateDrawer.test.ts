import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import type { DrawerOutline, Layout } from '@/core/types';
import { binId, gridUnits, heightUnits, mm } from '@/core/types';
import { normalizeDrawerOutline } from '@/shared/utils/drawerOutline';
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
  const withOutline = (outline: DrawerOutline = L_OUTLINE): Layout => {
    const base = makeLayout();
    return { ...base, drawer: { ...base.drawer, outline } };
  };

  it('clamps a shrink to the outline bounding grid and never touches the shape (#3149)', () => {
    // The L-shape spans the full 6×4 extent — a shrink below that would cut
    // into the drawn shape, so the width clamps back up to 6.
    const result = updateDrawer.handle({ width: 5 }, { aggregate: withOutline() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const changes = result.value.event.payload.changes;
    expect(changes.width).toBe(gridUnits(6));
    expect('outline' in changes).toBe(false);
  });

  it('keeps the outline byte-identical across a grow', () => {
    const result = updateDrawer.handle({ width: 8, depth: 6 }, { aggregate: withOutline() });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const payload = result.value.event.payload;
    expect(payload.changes.width).toBe(gridUnits(8));
    expect(payload.changes.depth).toBe(gridUnits(6));
    expect('outline' in payload.changes).toBe(false);

    const next = produce(withOutline(), (draft) => {
      updateDrawer.apply({ payload } as never, draft);
    });
    expect(next.drawer.outline).toBe(L_OUTLINE);
  });

  it('clamps to the half-unit ceiling of a shape that overhangs whole units', () => {
    // Shape reaching to 4.2 units needs a 4.5-unit drawer.
    const layout = withOutline({
      vertices: [
        { x: 0, y: 0 },
        { x: 4.2 * U, y: 0 },
        { x: 4.2 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    });
    const result = updateDrawer.handle({ width: 3 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.width).toBe(gridUnits(4.5));
  });

  it('floors on the outline MAX, not its width — an offset shape counts from its far edge', () => {
    // Shape spanning [2u, 5u]: only 3 units wide, but the drawer must keep
    // reaching 5 units for it to stay inside.
    const layout = withOutline({
      vertices: [
        { x: 2 * U, y: 0 },
        { x: 5 * U, y: 0 },
        { x: 5 * U, y: 3 * U },
        { x: 2 * U, y: 3 * U },
      ],
    });
    const result = updateDrawer.handle({ width: 3 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.width).toBe(gridUnits(5));
  });

  it('drops a rectangle-equivalent outline when the shrink lands on its bbox', () => {
    // 4×4 rect outline inside the 6×4 drawer (a real shape at 6 wide).
    // Shrinking to exactly 4 makes it trace the full rectangle — normalized
    // to "no outline", same as setOutline and the read-side guard.
    const layout = withOutline({
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    });
    const result = updateDrawer.handle({ width: 4 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const payload = result.value.event.payload;
    expect(payload.changes.width).toBe(gridUnits(4));
    expect('outline' in payload.changes).toBe(true);
    expect(payload.changes.outline).toBeUndefined();

    const next = produce(layout, (draft) => {
      updateDrawer.apply({ payload } as never, draft);
    });
    expect('outline' in next.drawer).toBe(false);
  });

  it('displaces bins that fall outside the unchanged outline after a grow', () => {
    // Growing depth leaves the shape as-is; a bin in the notch column stays
    // displaced.
    const layout = { ...withOutline(), bins: [makeBin('bin_notch', 5, 3)] };
    const result = updateDrawer.handle({ depth: 6 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.displacedBinIds).toEqual([binId('bin_notch')]);
  });

  it('replay of a legacy outline-reset event still deletes the key', () => {
    // Events persisted carried an adapted (or reset) outline in
    // `changes`; apply()/replay must keep honouring them.
    const event = {
      type: 'drawer.updated',
      payload: {
        changes: { width: gridUnits(4), outline: undefined },
        previous: { width: gridUnits(6), outline: L_OUTLINE },
        binsDisplacedToStaging: 0,
        displacedBinIds: [],
      },
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

  describe('measuredMm', () => {
    it('stores the measured drawer size', () => {
      const layout = makeLayout();
      const result = updateDrawer.handle(
        { width: 10, measuredMm: { width: 450, depth: 380, height: 60 } },
        { aggregate: layout }
      );

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.measuredMm).toEqual({
        width: 450,
        depth: 380,
        height: 60,
      });
      const applied = produce(layout, (draft) => {
        updateDrawer.apply({ type: 'drawer.updated', payload: result.value.event.payload }, draft);
      });
      expect(applied.drawer.measuredMm).toEqual({ width: 450, depth: 380, height: 60 });
    });

    it('clamps measured values to the sane mm range', () => {
      const result = updateDrawer.handle(
        { measuredMm: { width: 999999, depth: 0 } },
        { aggregate: makeLayout() }
      );

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.measuredMm).toEqual({
        width: CONSTRAINTS.MEASURED_MM_MAX,
        depth: CONSTRAINTS.MEASURED_MM_MIN,
      });
    });

    it('null clears the stored measurement via a present-but-undefined change', () => {
      const layout = {
        ...makeLayout(),
        drawer: { ...makeLayout().drawer, measuredMm: { width: 450, depth: 380 } },
      };
      const result = updateDrawer.handle({ measuredMm: null }, { aggregate: layout });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect('measuredMm' in result.value.event.payload.changes).toBe(true);
      expect(result.value.event.payload.changes.measuredMm).toBeUndefined();
      const applied = produce(layout, (draft) => {
        updateDrawer.apply({ type: 'drawer.updated', payload: result.value.event.payload }, draft);
      });
      expect('measuredMm' in applied.drawer).toBe(false);

      // Replay must delete the key the same way apply() does.
      const replayed = applyEvent(layout, {
        type: 'drawer.updated',
        payload: result.value.event.payload,
      } as never);
      expect('measuredMm' in replayed.drawer).toBe(false);
    });

    it('captures the previous measurement for undo', () => {
      const layout = {
        ...makeLayout(),
        drawer: { ...makeLayout().drawer, measuredMm: { width: 450, depth: 380 } },
      };
      const result = updateDrawer.handle(
        { measuredMm: { width: 500, depth: 400 } },
        { aggregate: layout }
      );

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.previous.measuredMm).toEqual({ width: 450, depth: 380 });
    });

    it('leaves the measurement untouched when not in the payload', () => {
      const result = updateDrawer.handle({ width: 8 }, { aggregate: makeLayout() });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect('measuredMm' in result.value.event.payload.changes).toBe(false);
    });
  });

  describe('gridShift (#3157)', () => {
    it('clamps the shift to half the pitch per axis', () => {
      const result = updateDrawer.handle(
        { gridShiftX: 30, gridShiftY: -30 },
        { aggregate: makeLayout() }
      );

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.gridShiftX).toBe(21);
      expect(result.value.event.payload.changes.gridShiftY).toBe(-21);
    });

    it('keeps a large shift on a large-pitch layout (pitch ceiling, not 42mm)', () => {
      const layout = { ...makeLayout(), gridUnitMm: mm(200) };
      const result = updateDrawer.handle({ gridShiftX: 90 }, { aggregate: layout });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.gridShiftX).toBe(90);
    });

    it('stores a zero shift as an absent key', () => {
      const layout = {
        ...makeLayout(),
        drawer: { ...makeLayout().drawer, gridShiftX: mm(5) },
      };
      const result = updateDrawer.handle({ gridShiftX: 0 }, { aggregate: layout });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect('gridShiftX' in result.value.event.payload.changes).toBe(true);
      expect(result.value.event.payload.changes.gridShiftX).toBeUndefined();
      const applied = produce(layout, (draft) => {
        updateDrawer.apply({ type: 'drawer.updated', payload: result.value.event.payload }, draft);
      });
      expect('gridShiftX' in applied.drawer).toBe(false);

      const replayed = applyEvent(layout, {
        type: 'drawer.updated',
        payload: result.value.event.payload,
      } as never);
      expect('gridShiftX' in replayed.drawer).toBe(false);
    });
  });
});

describe('v2 drawer.update with a measured drawer under the shape (#3635)', () => {
  const U = 42;
  // The reported layout: a T traced on a drawer measured 931 x 327mm, laid on
  // a 22 x 8 grid. 22u is 924mm, so the perimeter reaches 7mm past the grid.
  const MEASURED = { width: 931, depth: 327 };
  const T_SHAPE: DrawerOutline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 931, y: 0 },
      { x: 931, y: 327 },
      { x: 672, y: 327 },
      { x: 672, y: 189 },
      { x: 273, y: 189 },
      { x: 273, y: 327 },
      { x: 0, y: 327 },
    ],
  };
  const reportedLayout = (): Layout => {
    const base = makeLayout();
    return {
      ...base,
      gridUnitMm: mm(U),
      drawer: {
        ...base.drawer,
        width: gridUnits(22),
        depth: gridUnits(8),
        measuredMm: MEASURED,
        outline: T_SHAPE,
      },
    };
  };

  it('shrinks the grid inside the measured perimeter', () => {
    const layout = reportedLayout();
    const result = updateDrawer.handle({ width: 21, depth: 7 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const payload = result.value.event.payload;
    expect(payload.changes.width).toBe(gridUnits(21));
    expect(payload.changes.depth).toBe(gridUnits(7));
    // The shape is the material; a smaller grid never touches it.
    expect('outline' in payload.changes).toBe(false);
    const next = produce(layout, (draft) => {
      updateDrawer.apply({ type: 'drawer.updated', payload }, draft);
    });
    expect(next.drawer.outline).toBe(T_SHAPE);
  });

  it('survives the read-side normalizer after the shrink', () => {
    // The floor exists to keep the normalizer from clipping the shape on the
    // next load. Releasing it is only sound because outlineExtentMm reads the
    // measurement — so prove the round trip, not just the clamp.
    const layout = reportedLayout();
    const result = updateDrawer.handle({ width: 12, depth: 4 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const shrunk = produce(layout, (draft) => {
      updateDrawer.apply({ type: 'drawer.updated', payload: result.value.event.payload }, draft);
    });
    expect(normalizeDrawerOutline(shrunk).drawer.outline).toEqual(T_SHAPE);
  });

  it('still floors on the shape once the measurement is cleared in the same command', () => {
    // Floors read the measurement that LANDS, not the one being replaced.
    const result = updateDrawer.handle(
      { width: 12, measuredMm: null },
      { aggregate: reportedLayout() }
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.width).toBe(gridUnits(22.5));
  });

  it('releases the floor when the measurement is recorded in the same command', () => {
    const base = reportedLayout();
    const unmeasured: Layout = {
      ...base,
      drawer: { ...base.drawer, measuredMm: undefined },
    };
    const result = updateDrawer.handle(
      { width: 12, measuredMm: MEASURED },
      { aggregate: unmeasured }
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.width).toBe(gridUnits(12));
  });
});
