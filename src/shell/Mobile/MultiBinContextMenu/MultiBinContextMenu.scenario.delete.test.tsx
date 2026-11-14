import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiBinContextMenu } from './MultiBinContextMenu';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { connectSelectionPruning, eventBus } from '@/core/cqrs';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { binId, gridUnits, layerId } from '@/core/types';
import type { Bin } from '@/core/types';

const L1 = layerId('layer1');

describe('MultiBinContextMenu Delete all', () => {
  let unsubscribePruning: () => void;

  beforeEach(() => {
    resetAllStores();
    unsubscribePruning = connectSelectionPruning(eventBus);
    useHistoryStore.getState().clear();
  });

  afterEach(() => {
    unsubscribePruning();
  });

  function openWith(bins: Bin[], selected: string[]): void {
    useLayoutStore.setState({ layout: createTestLayout({ bins }) });
    useSelectionStore.getState().setSelectedBins(selected.map(binId));
    render(
      <MultiBinContextMenu
        binIds={selected.map(binId)}
        position={{ x: 0, y: 0 }}
        onClose={() => {}}
      />
    );
  }

  it("takes a paired bin's partner along, as one undo step", () => {
    openWith(
      [
        createTestBin({ id: binId('block'), layerId: L1, pairId: 'p1', pairRole: 'block' }),
        createTestBin({
          id: binId('rest'),
          layerId: L1,
          x: gridUnits(3),
          pairId: 'p1',
          pairRole: 'rest',
        }),
        createTestBin({ id: binId('other'), layerId: L1, x: gridUnits(5) }),
        createTestBin({ id: binId('kept'), layerId: L1, x: gridUnits(7) }),
      ],
      ['block', 'other']
    );

    fireEvent.click(screen.getByText('Delete all'));

    expect(useLayoutStore.getState().layout.bins.map((b) => b.id)).toEqual([binId('kept')]);
    expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Deleted 3 bins');
    expect(useHistoryStore.getState().past).toHaveLength(1);
  });

  it('deletes a full layer in one store update', () => {
    const bins: Bin[] = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 8; y++) {
        bins.push(
          createTestBin({ id: binId(`f-${x}-${y}`), layerId: L1, x: gridUnits(x), y: gridUnits(y) })
        );
      }
    }
    openWith(
      bins,
      bins.map((b) => b.id)
    );
    let storeUpdates = 0;
    const unsubscribe = useLayoutStore.subscribe(() => {
      storeUpdates++;
    });

    fireEvent.click(screen.getByText('Delete all'));
    unsubscribe();

    expect(storeUpdates).toBe(1);
    expect(useLayoutStore.getState().layout.bins).toEqual([]);
    expect(useHistoryStore.getState().past).toHaveLength(1);
  });
});
