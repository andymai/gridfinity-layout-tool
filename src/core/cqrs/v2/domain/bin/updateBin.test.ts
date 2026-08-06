import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits } from '@/core/types';
import { updateBin } from './updateBin';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.update', () => {
  it('captures previous values for the fields being changed', () => {
    const bin = makeBin('bin_1', { x: gridUnits(2), y: gridUnits(3), label: 'old' });
    const layout = makeLayout({ bins: [bin] });

    const result = updateBin.handle(
      { id: 'bin_1', updates: { label: 'new' } },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.previous).toEqual({ label: 'old' });
    expect(result.value.event.payload.changes).toEqual({ label: 'new' });
  });

  it('errors when the bin does not exist', () => {
    const layout = makeLayout();
    const result = updateBin.handle(
      { id: 'bin_gone', updates: { label: 'x' } },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('errors when spatial update would collide', () => {
    const a = makeBin('bin_a', { x: gridUnits(0), y: gridUnits(0) });
    const b = makeBin('bin_b', { x: gridUnits(2), y: gridUnits(0) });
    const layout = makeLayout({ bins: [a, b] });

    // Try to move bin_b to bin_a's position
    const result = updateBin.handle(
      { id: 'bin_b', updates: { x: 0, y: 0 } },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('skips placement validation for staging bins', () => {
    const bin = makeBin('bin_1', { layerId: STAGING_ID });
    const layout = makeLayout({ bins: [bin] });

    const result = updateBin.handle(
      { id: 'bin_1', updates: { x: 99, y: 99 } },
      { aggregate: layout }
    );
    expect(isOk(result)).toBe(true);
  });

  it('apply() round-trip equals native Object.assign', () => {
    const bin = makeBin('bin_1', { label: 'old' });
    const layout = makeLayout({ bins: [bin] });
    const result = updateBin.handle(
      { id: 'bin_1', updates: { label: 'new' } },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      updateBin.apply({ type: 'bin.updated', payload: result.value.event.payload }, draft);
    });
    const native = produce(layout, (draft) => {
      const b = draft.bins.find((b) => b.id === binId('bin_1'));
      if (b) Object.assign(b, { label: 'new' });
    });

    expect(applied).toEqual(native);
  });

  describe('overhang', () => {
    const OH = { enabled: true, left: 0, right: 14, front: 0, back: 0 };

    it('sets an explicit overhang', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1')] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { overhang: OH } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.overhang).toEqual(OH);
    });

    it('clears it when null is sent, and captures the previous value for undo', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { overhang: OH })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { overhang: null } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.overhang).toBeUndefined();
      expect(result.value.event.payload.previous.overhang).toEqual(OH);
    });

    // The values only hold for the position they were computed for, so a bare
    // move must not leave the bin extending into space it no longer borders.
    it('drops a stale overhang when the bin moves', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { overhang: OH })] });
      const result = updateBin.handle({ id: 'bin_1', updates: { x: 3 } }, { aggregate: layout });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect('overhang' in result.value.event.payload.changes).toBe(true);
      expect(result.value.event.payload.changes.overhang).toBeUndefined();
      expect(result.value.event.payload.previous.overhang).toEqual(OH);
    });

    it('keeps an overhang supplied alongside the move (reposition + re-extend)', () => {
      const next = { enabled: true, left: 7, right: 7, front: 0, back: 0 };
      const layout = makeLayout({ bins: [makeBin('bin_1', { overhang: OH })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { x: 3, overhang: next } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.overhang).toEqual(next);
    });

    it('leaves a non-spatial update alone', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { overhang: OH })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { label: 'x' } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect('overhang' in result.value.event.payload.changes).toBe(false);
    });
  });

  describe('size lock', () => {
    it('rejects a width change on a locked bin', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { locked: true })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { width: 2 } },
        { aggregate: layout }
      );
      expect(result.ok).toBe(false);
    });

    it('rejects a depth or height change on a locked bin', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { locked: true })] });
      expect(
        updateBin.handle({ id: 'bin_1', updates: { depth: 3 } }, { aggregate: layout }).ok
      ).toBe(false);
      expect(
        updateBin.handle({ id: 'bin_1', updates: { height: 5 } }, { aggregate: layout }).ok
      ).toBe(false);
    });

    it('allows moving a locked bin', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { locked: true })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { x: 2, y: 1 } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
    });

    it('allows relabelling and recategorising a locked bin', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { locked: true })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { label: 'M3 screws', notes: 'ready' } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
    });

    it('accepts a dimension re-sent at its current value', () => {
      const bin = makeBin('bin_1', { locked: true, width: gridUnits(2) });
      const layout = makeLayout({ bins: [bin] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { width: 2 } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
    });

    it('resizes when the same update unlocks the bin', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1', { locked: true })] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { locked: false, width: 2 } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(result.value.event.payload.changes.width).toBe(2);
    });

    it('rejects a resize that locks in the same update', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1')] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { locked: true, width: 2 } },
        { aggregate: layout }
      );
      expect(result.ok).toBe(false);
    });

    it('round-trips the flag through apply()', () => {
      const layout = makeLayout({ bins: [makeBin('bin_1')] });
      const result = updateBin.handle(
        { id: 'bin_1', updates: { locked: true } },
        { aggregate: layout }
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      const next = produce(layout, (draft) => {
        updateBin.apply({ type: 'bin.updated', payload: result.value.event.payload }, draft);
      });
      expect(next.bins[0].locked).toBe(true);
    });
  });
});
