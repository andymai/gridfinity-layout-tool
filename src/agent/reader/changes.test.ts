import { describe, expect, it } from 'vitest';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import { layoutRevision } from '@/core/cqrs/changeSet';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Layout } from '@/core/types';
import { createTestLayout } from '@/test/testUtils';
import { proposeChangesData } from '@/agent/contract';
import { appliedChanges, prepareChanges } from './changes';

const base = createTestLayout();
const bin = (id: string, x: number, y: number): Bin => ({
  id: binId(id),
  layerId: layerId('layer1'),
  x: gridUnits(x),
  y: gridUnits(y),
  width: gridUnits(2),
  depth: gridUnits(2),
  height: heightUnits(3),
  category: base.categories[0].id,
  label: id,
  notes: '',
});
const layout: Layout = createTestLayout({ bins: [bin('a', 0, 0)] });
const open = { id: 'layout-1', layout };
const addBin = (x: number) => ({
  op: 'addBin' as const,
  ref: 'new',
  layer: { id: 'layer1' },
  x,
  y: 0,
  width: 1,
  depth: 1,
  height: 3,
  label: 'M3 screws',
});

describe('prepareChanges', () => {
  it('previews a set on the open layout, with its id and revision', () => {
    const prepared = prepareChanges(open, { summary: 'Add a bin', ops: [addBin(3)] });
    if (prepared.kind !== 'preview') throw new Error(prepared.kind);
    expect(prepared.changeSet).toMatchObject({
      v: 1,
      layoutId: 'layout-1',
      baseRev: layoutRevision(layout),
      summary: 'Add a bin',
    });
    expect(prepared.result.layout.bins).toHaveLength(2);
    expect(Object.keys(prepared.result.refs)).toEqual(['new']);
    expect(layout.bins).toHaveLength(1);
  });

  it('names the op that the app refused, counted from 1, in data the server takes', () => {
    const prepared = prepareChanges(open, {
      summary: 'Two bins',
      ops: [addBin(3), { ...addBin(0), ref: 'other' }],
    });
    expect(prepared.kind).toBe('refused');
    if (prepared.kind !== 'refused') return;
    expect(prepared.data).toMatchObject({ outcome: 'refused', change: 2 });
    expect(proposeChangesData.safeParse(prepared.data).success).toBe(true);
  });

  it('refuses input that does not fit the tool, and names the op when it can', () => {
    const prepared = prepareChanges(open, { summary: 'Bad', ops: [{ op: 'paintBin' }] });
    expect(prepared).toMatchObject({ kind: 'refused', data: { change: 1 } });
    expect(prepareChanges(open, { ops: [] })).toMatchObject({
      kind: 'refused',
      data: { change: null },
    });
  });

  it('takes no changes without a layout of the reader own, such as a shared preview', () => {
    const input = { summary: 'Add', ops: [addBin(3)] };
    expect(prepareChanges(null, input)).toEqual({ kind: 'unavailable' });
    expect(prepareChanges({ id: SHARED_PREVIEW_ID, layout }, input)).toEqual({
      kind: 'unavailable',
    });
  });

  it('reports the ids that an applied set added', () => {
    const data = appliedChanges({ new: 'bin-9' });
    expect(data).toEqual({ outcome: 'applied', added: { new: 'bin-9' } });
    expect(proposeChangesData.safeParse(data).success).toBe(true);
  });
});
