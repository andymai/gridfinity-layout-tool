import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '@/core/constants';
import { binId, categoryId, gridUnits, heightUnits } from '@/core/types';
import type { Layout } from '@/core/types';
import { findFirstFit } from './findFirstFit';

function layoutWith(width: number, depth: number): Layout {
  const base = createDefaultLayout();
  return { ...base, drawer: { ...base.drawer, width: gridUnits(width), depth: gridUnits(depth) } };
}

describe('findFirstFit', () => {
  it('takes the first free position from the front-left', () => {
    const layout = layoutWith(4, 2);
    const layer = layout.layers[0].id;
    const taken = {
      ...layout,
      bins: [
        {
          id: binId('a'),
          layerId: layer,
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(1),
          height: heightUnits(3),
          category: categoryId('coral'),
          label: '',
          notes: '',
        },
      ],
    };
    expect(findFirstFit(taken, layer, 2, 1, heightUnits(3))).toEqual({
      x: 2,
      y: 0,
      width: 2,
      depth: 1,
    });
  });

  it('turns a bin that only fits the other way', () => {
    const layout = layoutWith(2, 4);
    expect(findFirstFit(layout, layout.layers[0].id, 3, 1, heightUnits(3))).toEqual({
      x: 0,
      y: 0,
      width: 1,
      depth: 3,
    });
  });

  it('steps in half units and honours a further check', () => {
    const layout = layoutWith(3, 1);
    const rect = findFirstFit(layout, layout.layers[0].id, 1, 1, heightUnits(3), {
      step: 0.5,
      accept: (r) => r.x > 0,
    });
    expect(rect).toEqual({ x: 0.5, y: 0, width: 1, depth: 1 });
  });
});
