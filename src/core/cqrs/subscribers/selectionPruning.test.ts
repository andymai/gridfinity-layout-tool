import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEventBus } from '../bus/eventBus';
import type { EventBus } from '../bus/eventBus';
import type { DomainEvent } from '../events';
import { eventId, correlationId, commandId } from '../types';
import { useSelectionStore, INITIAL_SELECTION_STATE } from '@/core/store/selection';
import { useLayoutStore } from '@/core/store/layout';
import { layoutId, binId, layerId, categoryId } from '@/core/types';
import type { Bin, Layer, Category } from '@/core/types';
import { connectSelectionPruning } from './selectionPruning';

function makeEvent<T extends DomainEvent['type']>(
  type: T,
  payload: Extract<DomainEvent, { type: T }>['payload']
): DomainEvent {
  return {
    type,
    payload,
    meta: {
      id: eventId(`evt_${Math.random()}`),
      timestamp: Date.now(),
      correlationId: correlationId('cor_1'),
      commandId: commandId('cmd_1'),
      aggregateId: layoutId('layout_1'),
      version: 1,
      schemaVersion: 1,
    },
  } as DomainEvent;
}

function makeBin(id: string, lid: string = 'layer1'): Bin {
  return {
    id: binId(id),
    layerId: layerId(lid),
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    category: categoryId('cat1'),
    label: '',
    notes: '',
  } as Bin;
}

function makeLayer(id: string): Layer {
  return { id: layerId(id), name: id, height: 1 } as Layer;
}

function makeCategory(id: string): Category {
  return { id: categoryId(id), name: id, color: '#ff0000' };
}

describe('selectionPruning subscriber', () => {
  let bus: EventBus;
  let unsubscribe: () => void;

  beforeEach(() => {
    bus = createEventBus();
    unsubscribe = connectSelectionPruning(bus);
    useSelectionStore.setState({ ...INITIAL_SELECTION_STATE });
  });

  afterEach(() => {
    unsubscribe();
    bus.clear();
  });

  describe('bin.deleted', () => {
    it('removes deleted bin from selectedBinIds', () => {
      const bin = makeBin('bin1');
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1'), binId('bin2')],
      });

      bus.publish(makeEvent('bin.deleted', { bin }));

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin2')]);
    });

    it('clears focusedBinId when deleted bin was focused', () => {
      const bin = makeBin('bin1');
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1')],
        focusedBinId: binId('bin1'),
      });

      bus.publish(makeEvent('bin.deleted', { bin }));

      expect(useSelectionStore.getState().focusedBinId).toBeNull();
    });

    it('clears quickLabelBinId when deleted bin had quick label open', () => {
      const bin = makeBin('bin1');
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1')],
        quickLabelBinId: binId('bin1'),
      });

      bus.publish(makeEvent('bin.deleted', { bin }));

      expect(useSelectionStore.getState().quickLabelBinId).toBeNull();
    });

    it('is a no-op when deleted bin is not in selection', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin2')],
        focusedBinId: binId('bin2'),
      });

      bus.publish(makeEvent('bin.deleted', { bin: makeBin('bin1') }));

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin2')]);
      expect(useSelectionStore.getState().focusedBinId).toBe(binId('bin2'));
    });
  });

  describe('bin.batchDeleted', () => {
    it('removes all deleted bins from selection', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1'), binId('bin2'), binId('bin3')],
        focusedBinId: binId('bin2'),
      });

      bus.publish(
        makeEvent('bin.batchDeleted', {
          bins: [makeBin('bin1'), makeBin('bin2')],
        })
      );

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin3')]);
      expect(useSelectionStore.getState().focusedBinId).toBeNull();
    });

    it('is a no-op when no deleted bins are in selection', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin3')],
      });

      bus.publish(
        makeEvent('bin.batchDeleted', {
          bins: [makeBin('bin1'), makeBin('bin2')],
        })
      );

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin3')]);
    });
  });

  describe('bin.layerCleared', () => {
    it('removes cleared bins from selection', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1'), binId('bin2'), binId('bin3')],
      });

      bus.publish(
        makeEvent('bin.layerCleared', {
          layerId: layerId('layer1'),
          binsRemoved: 2,
          bins: [makeBin('bin1'), makeBin('bin2')],
        })
      );

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin3')]);
    });
  });

  describe('bin.movedToStaging', () => {
    it('removes staged bin from selection', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1'), binId('bin2')],
      });

      bus.publish(
        makeEvent('bin.movedToStaging', {
          id: binId('bin1'),
          previousLayerId: layerId('layer1'),
        })
      );

      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin2')]);
    });

    it('clears focusedBinId when staged bin was focused', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1')],
        focusedBinId: binId('bin1'),
      });

      bus.publish(
        makeEvent('bin.movedToStaging', {
          id: binId('bin1'),
          previousLayerId: layerId('layer1'),
        })
      );

      expect(useSelectionStore.getState().focusedBinId).toBeNull();
    });
  });

  describe('layer.deleted', () => {
    it('resets activeLayerId when active layer is deleted', () => {
      useSelectionStore.setState({
        activeLayerId: layerId('layer2'),
      });

      // Mirror production ordering: store already updated before event fires
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          layers: [makeLayer('layer1')],
        },
      });

      bus.publish(
        makeEvent('layer.deleted', {
          layer: makeLayer('layer2'),
          deletedBinCount: 0,
        })
      );

      expect(useSelectionStore.getState().activeLayerId).toBe(layerId('layer1'));
    });

    it('does not change activeLayerId when a different layer is deleted', () => {
      useSelectionStore.setState({
        activeLayerId: layerId('layer1'),
      });

      // Mirror production ordering: layer2 already removed from store
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          layers: [makeLayer('layer1')],
        },
      });

      bus.publish(
        makeEvent('layer.deleted', {
          layer: makeLayer('layer2'),
          deletedBinCount: 0,
        })
      );

      expect(useSelectionStore.getState().activeLayerId).toBe(layerId('layer1'));
    });
  });

  describe('category.deleted', () => {
    it('resets activeCategoryId when active category is deleted', () => {
      useSelectionStore.setState({
        activeCategoryId: categoryId('cat2'),
      });

      // Mirror production ordering: store already updated before event fires
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          categories: [makeCategory('cat1')],
        },
      });

      bus.publish(
        makeEvent('category.deleted', {
          category: makeCategory('cat2'),
        })
      );

      expect(useSelectionStore.getState().activeCategoryId).toBe(categoryId('cat1'));
    });

    it('does not change activeCategoryId when a different category is deleted', () => {
      useSelectionStore.setState({
        activeCategoryId: categoryId('cat1'),
      });

      // Mirror production ordering: cat2 already removed from store
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          categories: [makeCategory('cat1')],
        },
      });

      bus.publish(
        makeEvent('category.deleted', {
          category: makeCategory('cat2'),
        })
      );

      expect(useSelectionStore.getState().activeCategoryId).toBe(categoryId('cat1'));
    });
  });

  describe('idempotency', () => {
    it('handles duplicate events without error', () => {
      const bin = makeBin('bin1');
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1')],
      });

      bus.publish(makeEvent('bin.deleted', { bin }));
      bus.publish(makeEvent('bin.deleted', { bin }));

      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    });

    it('handles empty selection gracefully', () => {
      useSelectionStore.setState({ selectedBinIds: [] });

      bus.publish(makeEvent('bin.deleted', { bin: makeBin('bin1') }));

      expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
    });
  });

  describe('unsubscribe', () => {
    it('stops reacting to events after unsubscribe', () => {
      useSelectionStore.setState({
        selectedBinIds: [binId('bin1')],
      });

      unsubscribe();

      bus.publish(makeEvent('bin.deleted', { bin: makeBin('bin1') }));

      // Selection should NOT be pruned after unsubscribe
      expect(useSelectionStore.getState().selectedBinIds).toEqual([binId('bin1')]);
    });
  });
});
