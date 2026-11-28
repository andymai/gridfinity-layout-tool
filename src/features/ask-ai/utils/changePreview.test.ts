import { describe, expect, it } from 'vitest';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin } from '@/core/types';
import { createTestLayout } from '@/test/testUtils';
import { previewChanges } from './changePreview';

const t = (key: string, vars?: Record<string, unknown>): string =>
  vars ? `${key} ${JSON.stringify(vars)}` : key;
const base = createTestLayout();
const bin = (id: string, x: number, label: string): Bin => ({
  id: binId(id),
  layerId: layerId('layer1'),
  x: gridUnits(x),
  y: gridUnits(0),
  width: gridUnits(1),
  depth: gridUnits(1),
  height: heightUnits(3),
  category: base.categories[0].id,
  label,
  notes: '',
});
const layout = createTestLayout({ bins: [bin('a', 0, 'Pliers'), bin('b', 1, 'Glue')] });
const open = { id: 'layout-1', layout };

describe('previewChanges', () => {
  it('says what each op does and marks the bins that it adds or changes', () => {
    const preview = previewChanges(
      open,
      {
        summary: 'Tidy up',
        ops: [
          {
            op: 'addBin',
            ref: 'm3',
            layer: { id: 'layer1' },
            x: 3,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            label: 'M3',
          },
          { op: 'updateBin', bin: { ref: 'm3' }, set: { height: 4 } },
          { op: 'stashBin', bin: { id: 'a' } },
        ],
      },
      t
    );
    expect(preview.lines).toEqual([
      'askAi.change.addBin {"width":"1","depth":"1","x":"3","y":"0","label":"M3"}',
      'askAi.change.updateBin {"label":"M3"}',
      'askAi.change.stashBin {"label":"Pliers"}',
    ]);
    if (preview.kind !== 'preview') throw new Error(preview.kind);
    expect(preview.bins.map((b) => [b.label, b.changed])).toEqual([
      ['Glue', false],
      ['M3', true],
    ]);
    expect(preview.stashed).toBe(1);
  });

  it('gives the reason when the set no longer fits the layout', () => {
    const preview = previewChanges(
      open,
      {
        summary: 'Overlap',
        ops: [{ op: 'addBin', layer: { id: 'layer1' }, x: 0, y: 0, width: 1, depth: 1, height: 3 }],
      },
      t
    );
    expect(preview).toMatchObject({ kind: 'refused', reason: expect.stringContaining('collides') });
  });

  it('shows nothing to apply without a layout of the reader own', () => {
    expect(previewChanges(null, { summary: 'x', ops: [] }, t)).toEqual({
      kind: 'unavailable',
      lines: [],
    });
  });
});
