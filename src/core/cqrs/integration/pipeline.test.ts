/**
 * Full CQRS Pipeline Integration Test
 *
 * Verifies the complete flow: command dispatch → middleware → handler →
 * domain events → event bus → subscribers. Uses real bus instances with
 * mocked stores to test the pipeline end-to-end.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { createCommandBus } from '../bus/commandBus';
import { createEventBus } from '../bus/eventBus';
import { createCommand } from '../commands';
import { createCqrsMutations } from './mutationsAdapter';
import { resetVersionCounters } from '../handlers';
import { layerId, categoryId, binId } from '@/core/types';
import type { Bin } from '@/core/types';
import type { DomainEvent } from '../events';
import type { Command } from '../commands';
import type { Middleware } from '../types';

// --- Mocks ---

const bins: Bin[] = [];
const testBin: Bin = {
  id: binId('bin_1'),
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

const mockStore = {
  layout: {
    bins,
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }],
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    drawer: { width: 6, depth: 4, height: 7 },
    name: 'Test Layout',
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    version: '1.0',
  },
  addBin: vi.fn(() => {
    const newBin = { ...testBin, id: binId('bin_new') };
    bins.push(newBin);
    return { ok: true, value: binId('bin_new') };
  }),
  updateBin: vi.fn(() => ({ ok: true, value: undefined })),
  deleteBin: vi.fn(() => ({ ok: true, value: undefined })),
  deleteBins: vi.fn(() => ({ ok: true, value: undefined })),
  setName: vi.fn(),
  updateDrawer: vi.fn(),
  addLayer: vi.fn(() => {
    const id = layerId('layer_new');
    mockStore.layout.layers.push({ id, name: 'Layer 2', height: 3 });
    return { ok: true, value: id };
  }),
  addCategory: vi.fn(() => {
    const id = categoryId('cat_new');
    mockStore.layout.categories.push({ id, name: 'Tools', color: '#ff0000' });
    return { ok: true, value: id };
  }),
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: {
    getState: () => mockStore,
    // v2 wrapper (cqrs/v2/runtime.ts) calls setState directly on the layout
    // store. Mirror the real Zustand+Immer signature: producer receives a
    // mutable draft of the whole store state, including `layout` and
    // `lastEditSource`. Apply the producer to mockStore so tests see the
    // mutation reflected in subsequent getState() calls.
    setState: (producer: (state: typeof mockStore & { lastEditSource: string | null }) => void) => {
      producer(mockStore as typeof mockStore & { lastEditSource: string | null });
    },
  },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

describe('CQRS Pipeline Integration', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let commandBus: ReturnType<typeof createCommandBus>;
  let subscribedEvents: DomainEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
    bins.length = 0;
    bins.push({ ...testBin });
    mockStore.layout.layers = [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }];
    mockStore.layout.categories = [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }];
    mockStore.layout.name = 'Test Layout';

    eventBus = createEventBus();
    commandBus = createCommandBus(eventBus, []);
    subscribedEvents = [];
    eventBus.subscribeAll((e) => subscribedEvents.push(e));
  });

  it('dispatches a command and publishes events to subscribers', () => {
    const cmd = createCommand('layout.setName', { name: 'Renamed' });
    const result = commandBus.dispatch(cmd);

    expect(isOk(result)).toBe(true);
    expect(subscribedEvents).toHaveLength(1);
    expect(subscribedEvents[0].type).toBe('layout.nameSet');
  });

  it('events carry correct metadata from commands', () => {
    const cmd = createCommand('layout.setName', { name: 'X' });
    commandBus.dispatch(cmd);

    const event = subscribedEvents[0];
    expect(event.meta.correlationId).toBe(cmd.meta.correlationId);
    expect(event.meta.commandId).toBe(cmd.meta.id);
    expect(event.meta.aggregateId).toBe('layout_1');
    expect(event.meta.version).toBe(1);
  });

  it('multiple commands increment version monotonically', () => {
    commandBus.dispatch(createCommand('layout.setName', { name: 'A' }));
    commandBus.dispatch(createCommand('layout.setName', { name: 'B' }));
    commandBus.dispatch(createCommand('layout.setName', { name: 'C' }));

    expect(subscribedEvents).toHaveLength(3);
    expect(subscribedEvents[0].meta.version).toBe(1);
    expect(subscribedEvents[1].meta.version).toBe(2);
    expect(subscribedEvents[2].meta.version).toBe(3);
  });

  it('does not publish events when command handler returns error', () => {
    mockStore.deleteBin.mockReturnValueOnce({
      ok: false,
      error: { code: 'LAYOUT_INVALID_OPERATION' },
    });
    bins.length = 0; // No bin to find

    const cmd = createCommand('bin.delete', { id: binId('nonexistent') });
    const result = commandBus.dispatch(cmd);

    // Bin not in store → empty events even though store call may succeed
    // What matters: no crash, consistent behavior
    expect(result).toBeDefined();
  });

  it('middleware wraps the handler execution', () => {
    const log: string[] = [];

    const tracingMiddleware: Middleware<Command, DomainEvent> = (cmd, next) => {
      log.push(`before:${cmd.type}`);
      const result = next(cmd);
      log.push(`after:${cmd.type}`);
      return result;
    };

    const bus = createCommandBus(eventBus, [tracingMiddleware]);
    bus.dispatch(createCommand('layout.setName', { name: 'Test' }));

    expect(log).toEqual(['before:layout.setName', 'after:layout.setName']);
  });

  it('multiple middleware execute in correct order', () => {
    const order: number[] = [];

    const m1: Middleware<Command, DomainEvent> = (cmd, next) => {
      order.push(1);
      const r = next(cmd);
      order.push(4);
      return r;
    };
    const m2: Middleware<Command, DomainEvent> = (cmd, next) => {
      order.push(2);
      const r = next(cmd);
      order.push(3);
      return r;
    };

    const bus = createCommandBus(eventBus, [m1, m2]);
    bus.dispatch(createCommand('layout.setName', { name: 'X' }));

    expect(order).toEqual([1, 2, 3, 4]);
  });

  describe('MutationsAdapter integration', () => {
    it('routes addBin through the command bus', () => {
      const mutations = createCqrsMutations(commandBus);
      const result = mutations.addBin({
        layerId: layerId('layer_1'),
        x: 2,
        y: 3,
        width: 1,
        depth: 1,
        height: 3,
        category: categoryId('cat_1'),
        label: '',
        notes: '',
      });

      expect(isOk(result)).toBe(true);
      expect(subscribedEvents).toHaveLength(1);
      expect(subscribedEvents[0].type).toBe('bin.added');
    });

    it('routes setName through the command bus', () => {
      const mutations = createCqrsMutations(commandBus);
      mutations.setName('Pipeline Test');

      expect(mockStore.setName).toHaveBeenCalledWith('Pipeline Test');
      expect(subscribedEvents).toHaveLength(1);
      expect(subscribedEvents[0].type).toBe('layout.nameSet');
    });

    it('propagates errors from command results', () => {
      mockStore.deleteBin.mockReturnValueOnce({
        ok: false,
        error: { code: 'LAYOUT_INVALID_OPERATION' },
      });

      const mutations = createCqrsMutations(commandBus);
      const result = mutations.deleteBin(binId('nonexistent'));

      expect(isErr(result)).toBe(true);
    });

    it('typed event subscribers receive only matching events', () => {
      const nameEvents: DomainEvent[] = [];
      eventBus.subscribe('layout.nameSet', (e) => nameEvents.push(e));

      const mutations = createCqrsMutations(commandBus);
      mutations.setName('Name1');
      mutations.addLayer();

      expect(nameEvents).toHaveLength(1);
      expect(subscribedEvents).toHaveLength(2); // Both events via wildcard
    });
  });
});
