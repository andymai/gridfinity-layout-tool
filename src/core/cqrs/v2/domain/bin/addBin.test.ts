/**
 * Property tests for the v2 `bin.add` command.
 *
 * Two invariants every defineCommand should hold:
 *
 * 1. handle() determinism — a pure function of (payload, ctx). Calling it
 *    twice against the same frozen layout snapshot must produce structurally
 *    identical output (modulo the freshly-generated BinId).
 *
 * 2. apply() round-trip — applying the event produced by handle() to the
 *    same starting layout must produce the same Layout state as the v1
 *    native execution. This is the core invariant of v2: "the event payload
 *    + apply alone reproduce the mutation."
 */

import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { Bin, Layout } from '@/core/types';
import { binId, layerId, categoryId } from '@/core/types';
import { addBin } from './addBin';

function makeLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: '1.0',
    name: 'Test',
    drawer: { width: 6, depth: 4, height: 7 } as Layout['drawer'],
    printBedSize: 256 as Layout['printBedSize'],
    gridUnitMm: 42 as Layout['gridUnitMm'],
    heightUnitMm: 7 as Layout['heightUnitMm'],
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }],
    bins: [],
    ...overrides,
  };
}

const validPayload = {
  layerId: layerId('layer_1'),
  x: 0,
  y: 0,
  width: 1,
  depth: 1,
  height: 3,
  category: categoryId('cat_1'),
  label: '',
  notes: '',
};

describe('v2 bin.add', () => {
  describe('handle()', () => {
    it('returns ok with new bin in event payload when placement is valid', () => {
      const layout = makeLayout();
      const result = addBin.handle(validPayload, { aggregate: layout });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      expect(typeof result.value.value).toBe('string');
      expect(result.value.value.length).toBeGreaterThan(0);
      expect(result.value.event.payload.bin).toMatchObject(validPayload);
      expect(result.value.event.payload.bin.id).toBe(result.value.value);
    });

    it('returns err when layerId references a non-existent layer', () => {
      const layout = makeLayout();
      const result = addBin.handle(
        { ...validPayload, layerId: layerId('layer_gone') },
        { aggregate: layout }
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION_INVALID_LAYER');
    });

    it('returns err when placement collides with existing bin', () => {
      const existing: Bin = {
        id: binId('bin_existing'),
        layerId: layerId('layer_1'),
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: categoryId('cat_1'),
        label: '',
        notes: '',
      };
      const layout = makeLayout({ bins: [existing] });
      const result = addBin.handle(validPayload, { aggregate: layout });

      expect(result.ok).toBe(false);
    });

    it('is deterministic: two invocations against same layout produce structurally identical events (modulo BinId)', () => {
      const layout = makeLayout();
      const r1 = addBin.handle(validPayload, { aggregate: layout });
      const r2 = addBin.handle(validPayload, { aggregate: layout });

      expect(isOk(r1) && isOk(r2)).toBe(true);
      if (!isOk(r1) || !isOk(r2)) return;

      // BinIds differ (generateBinId is non-deterministic by design — fresh
      // id per call). Everything else must match exactly.
      const { id: id1, ...rest1 } = r1.value.event.payload.bin;
      const { id: id2, ...rest2 } = r2.value.event.payload.bin;
      expect(id1).not.toBe(id2);
      expect(rest1).toEqual(rest2);
    });
  });

  describe('apply() round-trip', () => {
    it('applying the event to L0 yields the same bin set as native push', () => {
      const layout = makeLayout();
      const result = addBin.handle(validPayload, { aggregate: layout });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Apply path: produce a draft, apply the event
      const applied = produce(layout, (draft) => {
        addBin.apply({ type: 'bin.added', payload: result.value.event.payload }, draft);
      });

      // Native equivalent: push the bin directly
      const native = produce(layout, (draft) => {
        draft.bins.push(result.value.event.payload.bin);
      });

      expect(applied.bins).toEqual(native.bins);
      expect(applied).toEqual(native);
    });

    it('applying the event onto an empty layout produces exactly one bin', () => {
      const layout = makeLayout();
      const result = addBin.handle(validPayload, { aggregate: layout });
      if (!isOk(result)) throw new Error('handle failed');

      const applied = produce(layout, (draft) => {
        addBin.apply({ type: 'bin.added', payload: result.value.event.payload }, draft);
      });

      expect(applied.bins).toHaveLength(1);
      expect(applied.bins[0]).toEqual(result.value.event.payload.bin);
    });
  });

  describe('definition metadata', () => {
    it('declares the expected static fields', () => {
      expect(addBin.type).toBe('bin.add');
      expect(addBin.aggregate).toBe('layout');
      expect(addBin.emitted).toBe('bin.added');
      expect(addBin.schemaVersion).toBe(1);
      expect(addBin.descriptionKey).toBe('undo.action.binAdd');
    });
  });
});
