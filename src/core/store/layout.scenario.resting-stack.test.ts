/**
 * Bins of different heights stacked across layers, driven through the real
 * command bus the editor uses. Before bins rested on what was below them,
 * each layer sat at the sum of the layer heights under it: short bins left
 * gaps, a bin with nothing under it floated, and the layer heights had to fit
 * inside the drawer, so mixed stacks forced the drawer height up.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { commandBus } from '@/core/cqrs';
import { createCqrsMutations } from '@/core/cqrs/integration/mutationsAdapter';
import { getRestingStack } from '@/shared/utils/restingStack';
import { STAGING_ID } from '@/core/constants';
import { isErr } from '@/core/result';
import { resetAllStores, expectOk } from '@/test/testUtils';
import type { Mutations } from '@/shared/contexts/MutationsContext';
import type { BinId, LayerId } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';

let mutations: Mutations;

function restingZ(id: BinId): number | undefined {
  const { bins, layers } = useLayoutStore.getState().layout;
  return getRestingStack(bins, layers).bins.get(id)?.zStart;
}

function place(layerId: LayerId, x: number, y: number, w: number, d: number, h: number): BinId {
  const { categories } = useLayoutStore.getState().layout;
  return expectOk(
    mutations.addBin({
      layerId,
      x: gridUnits(x),
      y: gridUnits(y),
      width: gridUnits(w),
      depth: gridUnits(d),
      height: heightUnits(h),
      category: categories[0].id,
      label: '',
      notes: '',
    })
  );
}

describe('stacking mixed-height bins across layers', () => {
  let bottom: LayerId;
  let middle: LayerId;
  let top: LayerId;

  beforeEach(() => {
    resetAllStores();
    mutations = createCqrsMutations(commandBus);
    mutations.updateDrawer({ width: gridUnits(8), depth: gridUnits(6), height: heightUnits(12) });
    bottom = useLayoutStore.getState().layout.layers[0].id;
    expectOk(mutations.updateLayer(bottom, { height: heightUnits(6) }));
    // Three 6u layers add up to 18u in a 12u drawer: allowed, because a
    // layer's height is only the default for bins drawn on it.
    middle = expectOk(mutations.addLayer());
    expectOk(mutations.updateLayer(middle, { height: heightUnits(6) }));
    top = expectOk(mutations.addLayer());
    expectOk(mutations.updateLayer(top, { height: heightUnits(6) }));
  });

  it('adds layers whose heights add up past the drawer', () => {
    const { layers, drawer } = useLayoutStore.getState().layout;
    expect(layers.reduce((sum, l) => sum + l.height, 0)).toBe(18);
    expect(drawer.height).toBe(12);
  });

  it('rests each bin on the one below instead of at its layer plane', () => {
    const short = place(bottom, 0, 0, 2, 2, 3);
    const onShort = place(middle, 0, 0, 2, 2, 4);
    const tall = place(bottom, 4, 0, 2, 2, 8);
    const onTall = place(middle, 4, 0, 2, 2, 3);

    expect(restingZ(onShort)).toBe(3);
    expect(restingZ(onTall)).toBe(8);
    expect(restingZ(short)).toBe(0);
    expect(restingZ(tall)).toBe(0);
  });

  it('drops a bin with nothing under it to the plate instead of floating', () => {
    const lonely = place(top, 6, 4, 1, 1, 2);
    expect(restingZ(lonely)).toBe(0);
  });

  it('refuses only stacks that really pass the drawer top', () => {
    place(bottom, 0, 0, 2, 2, 6);
    place(middle, 0, 0, 2, 2, 4);

    // 6 + 4 + 2 = 12 fits exactly; 6 + 4 + 3 does not.
    place(top, 0, 0, 2, 2, 2);
    const result = mutations.addBin({
      layerId: top,
      x: gridUnits(1),
      y: gridUnits(1),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: useLayoutStore.getState().layout.categories[0].id,
      label: '',
      notes: '',
    });
    expect(isErr(result)).toBe(true);
  });

  it('keeps a bin’s own height when it comes back from the stash', () => {
    const stashed = expectOk(
      mutations.addBin({
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
        height: heightUnits(4),
        category: useLayoutStore.getState().layout.categories[0].id,
        label: '',
        notes: '',
      })
    );
    expectOk(mutations.moveBinFromStaging(stashed, middle, gridUnits(0), gridUnits(0)));

    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === stashed);
    expect(bin?.height).toBe(4);
  });

  it('shrinks the drawer down to the tallest stack and no further', () => {
    place(bottom, 0, 0, 2, 2, 3);
    place(middle, 0, 0, 2, 2, 4);
    place(bottom, 4, 0, 2, 2, 5);

    mutations.updateDrawer({ height: heightUnits(2) });

    expect(useLayoutStore.getState().layout.drawer.height).toBe(7);
  });
});
