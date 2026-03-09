import { describe, it, expect } from 'vitest';
import { applyEvent, replayEvents } from './replay';
import type { Layout, Bin } from '@/core/types';
import { binId, layerId, categoryId, layoutId } from '@/core/types';
import { eventId, correlationId, commandId } from '../types';
import type { DomainEvent } from '../events';

const baseMeta = {
  id: eventId('evt_1'),
  timestamp: Date.now(),
  correlationId: correlationId('cor_1'),
  commandId: commandId('cmd_1'),
  aggregateId: layoutId('layout_1'),
  version: 1,
};

function makeLayout(bins: Bin[] = []): Layout {
  return {
    version: '1.0',
    name: 'Test',
    drawer: { width: 6, depth: 4, height: 7 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 1 }],
    bins,
  };
}

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: binId('bin_1'),
    layerId: layerId('layer_1'),
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 1,
    category: categoryId('cat_1'),
    label: '',
    notes: '',
    ...overrides,
  };
}

describe('applyEvent', () => {
  it('applies bin.added', () => {
    const layout = makeLayout();
    const bin = makeBin();
    const event: DomainEvent = {
      type: 'bin.added',
      payload: { bin },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.bins).toHaveLength(1);
    expect(result.bins[0].id).toBe('bin_1');
    // Original not mutated
    expect(layout.bins).toHaveLength(0);
  });

  it('applies bin.updated', () => {
    const bin = makeBin();
    const layout = makeLayout([bin]);
    const event: DomainEvent = {
      type: 'bin.updated',
      payload: {
        id: binId('bin_1'),
        changes: { label: 'Updated' },
        previous: { label: '' },
      },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.bins[0].label).toBe('Updated');
  });

  it('applies bin.deleted', () => {
    const bin = makeBin();
    const layout = makeLayout([bin]);
    const event: DomainEvent = {
      type: 'bin.deleted',
      payload: { bin },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.bins).toHaveLength(0);
  });

  it('applies layer.added', () => {
    const layout = makeLayout();
    const event: DomainEvent = {
      type: 'layer.added',
      payload: { layer: { id: layerId('layer_2'), name: 'Layer 2', height: 1 } },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.layers).toHaveLength(2);
  });

  it('applies layer.deleted — removes layer and its bins', () => {
    const bin1 = makeBin({ id: binId('bin_1'), layerId: layerId('layer_1') });
    const bin2 = makeBin({ id: binId('bin_2'), layerId: layerId('layer_2') });
    const layout = makeLayout([bin1, bin2]);
    layout.layers.push({ id: layerId('layer_2'), name: 'Layer 2', height: 1 });

    const event: DomainEvent = {
      type: 'layer.deleted',
      payload: {
        layer: { id: layerId('layer_1'), name: 'Layer 1', height: 1 },
        deletedBinCount: 0,
      },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].id).toBe('layer_2');
    // Bins on deleted layer are removed, not displaced to staging
    expect(result.bins).toHaveLength(1);
    expect(result.bins[0].id).toBe('bin_2');
  });

  it('applies category.deleted — removes category only', () => {
    const layout = makeLayout();
    layout.categories.push({ id: categoryId('cat_2'), name: 'Tools', color: '#ff0000' });

    const event: DomainEvent = {
      type: 'category.deleted',
      payload: { category: { id: categoryId('cat_2'), name: 'Tools', color: '#ff0000' } },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].id).toBe('cat_1');
  });

  it('applies layout.nameSet', () => {
    const layout = makeLayout();
    const event: DomainEvent = {
      type: 'layout.nameSet',
      payload: { name: 'New Name', previousName: 'Test' },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.name).toBe('New Name');
  });

  it('applies drawer.updated', () => {
    const layout = makeLayout();
    const event: DomainEvent = {
      type: 'drawer.updated',
      payload: {
        changes: { width: 8 },
        previous: { width: 6 },
        binsDisplacedToStaging: 0,
      },
      meta: baseMeta,
    };

    const result = applyEvent(layout, event);
    expect(result.drawer.width).toBe(8);
  });
});

describe('replayEvents', () => {
  it('replays a sequence of events', () => {
    const layout = makeLayout();
    const bin = makeBin();

    const events: DomainEvent[] = [
      { type: 'bin.added', payload: { bin }, meta: { ...baseMeta, version: 1 } },
      {
        type: 'bin.updated',
        payload: {
          id: binId('bin_1'),
          changes: { label: 'Hello' },
          previous: { label: '' },
        },
        meta: { ...baseMeta, version: 2 },
      },
      {
        type: 'layout.nameSet',
        payload: { name: 'Replayed', previousName: 'Test' },
        meta: { ...baseMeta, version: 3 },
      },
    ];

    const result = replayEvents(layout, events);
    expect(result.bins).toHaveLength(1);
    expect(result.bins[0].label).toBe('Hello');
    expect(result.name).toBe('Replayed');
  });

  it('does not mutate the base layout', () => {
    const layout = makeLayout();
    const bin = makeBin();

    replayEvents(layout, [{ type: 'bin.added', payload: { bin }, meta: baseMeta }]);

    expect(layout.bins).toHaveLength(0);
  });
});
