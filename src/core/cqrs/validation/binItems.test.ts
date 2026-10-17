/**
 * Through real dispatch rather than `schema.parse`: the pipeline validates a
 * payload and hands the handler the original, so a schema transform would pass
 * validation and never reach what is stored.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { commandBus } from '@/core/cqrs';
import { createCqrsMutations } from '@/core/cqrs/integration/mutationsAdapter';
import { resetAllStores, expectErr, expectOk } from '@/test/testUtils';
import type { Mutations } from '@/shared/contexts/MutationsContext';
import type { BinId, BinItem } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';

let mutations: Mutations;

function addBin(items?: BinItem[], x = 0): BinId {
  const { layout } = useLayoutStore.getState();
  return expectOk(
    mutations.addBin({
      layerId: layout.layers[0].id,
      x: gridUnits(x),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: layout.categories[0].id,
      label: '',
      notes: '',
      ...(items ? { items } : {}),
    })
  );
}

const stored = (id: BinId): BinItem[] | undefined =>
  useLayoutStore.getState().layout.bins.find((b) => b.id === id)?.items;

describe('bin items through command dispatch', () => {
  beforeEach(() => {
    resetAllStores();
    mutations = createCqrsMutations(commandBus);
  });

  it('stores names trimmed and drops keys an item does not define, on update and on add', () => {
    const messy = [{ id: 'i1', name: '  Screws  ', photo: 'blob:x' }] as unknown as BinItem[];
    const updated = addBin();
    expectOk(mutations.updateBin(updated, { items: messy }));
    expect(stored(updated)).toEqual([{ id: 'i1', name: 'Screws' }]);
    expect(stored(addBin(messy, 2))).toEqual([{ id: 'i1', name: 'Screws' }]);
  });

  it('rejects a name past the cap before it is trimmed', () => {
    const id = addBin();
    const padded = [{ id: 'i1', name: `${' '.repeat(100)}Screws` }];
    expectErr(mutations.updateBin(id, { items: padded }));
    expect(stored(id)).toBeUndefined();
  });

  it('rejects a blank name', () => {
    const id = addBin();
    expectErr(mutations.updateBin(id, { items: [{ id: 'i1', name: '   ' }] }));
    expect(stored(id)).toBeUndefined();
  });

  it('clears the field with an empty list', () => {
    const id = addBin([{ id: 'i1', name: 'Screws' }]);
    expectOk(mutations.updateBin(id, { items: [] }));
    expect(stored(id)).toBeUndefined();
  });
});
