import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCommandBus } from './commandBus';
import { createEventBus } from './eventBus';
import { createCommand } from '../commands';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { Middleware } from '../types';
import { ok, isOk, isErr } from '@/core/result';

// Mock the layout and library stores. The mock state is defined outside
// the factory so v2 setState producers can mutate it (the v2 wrapper
// applies events through useLayoutStore.setState — see cqrs/v2/runtime.ts).
const mockLayoutState = {
  layout: {
    name: 'Test Layout',
    bins: [],
    layers: [{ id: 'layer_1', name: 'Layer 1', height: 1 }],
    categories: [{ id: 'cat_1', name: 'Default', color: '#808080' }],
    drawer: { width: 6, depth: 4, height: 7 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    version: '1.0',
  },
  lastEditSource: null as string | null,
  setName: vi.fn(),
  deleteBin: () => ({ ok: false, error: { code: 'LAYOUT_INVALID_OPERATION' } }),
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: {
    getState: () => mockLayoutState,
    setState: (producer: (state: typeof mockLayoutState) => void) => {
      producer(mockLayoutState);
    },
  },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({
      library: { activeLayoutId: 'layout_1' },
    }),
  },
}));

vi.mock('@/core/cqrs/undo/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({
      push: vi.fn(),
    }),
  },
}));

describe('CommandBus', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let commandBus: ReturnType<typeof createCommandBus>;

  beforeEach(() => {
    eventBus = createEventBus();
    // No middleware for cleaner unit tests
    commandBus = createCommandBus(eventBus, []);
  });

  it('dispatches commands to handlers and returns results', () => {
    const command = createCommand('layout.setName', { name: 'New Name' });
    const result = commandBus.dispatch(command);

    expect(isOk(result)).toBe(true);
  });

  it('publishes events to the event bus after successful command', () => {
    const events: DomainEvent[] = [];
    eventBus.subscribeAll((e) => events.push(e));

    const command = createCommand('layout.setName', { name: 'New Name' });
    commandBus.dispatch(command);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('layout.nameSet');
  });

  it('executes middleware in order', () => {
    const order: string[] = [];

    const middleware1: Middleware<Command, DomainEvent> = (cmd, next) => {
      order.push('before-1');
      const result = next(cmd);
      order.push('after-1');
      return result;
    };

    const middleware2: Middleware<Command, DomainEvent> = (cmd, next) => {
      order.push('before-2');
      const result = next(cmd);
      order.push('after-2');
      return result;
    };

    const bus = createCommandBus(eventBus, [middleware1, middleware2]);
    bus.dispatch(createCommand('layout.setName', { name: 'Test' }));

    expect(order).toEqual(['before-1', 'before-2', 'after-2', 'after-1']);
  });

  it('middleware can short-circuit the pipeline', () => {
    const blockingMiddleware: Middleware<Command, DomainEvent> = (_cmd, _next) => {
      return ok({ value: 'blocked', events: [] });
    };

    const handlerSpy = vi.fn();
    const bus = createCommandBus(eventBus, [blockingMiddleware]);

    const result = bus.dispatch(createCommand('layout.setName', { name: 'Test' }));

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBe('blocked');
    }
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('does not publish events on handler error', () => {
    const events: DomainEvent[] = [];
    eventBus.subscribeAll((e) => events.push(e));

    // Try to delete a non-existent bin
    const command = createCommand('bin.delete', { id: 'nonexistent' as never });
    const result = commandBus.dispatch(command);

    expect(isErr(result)).toBe(true);
    expect(events).toHaveLength(0);
  });
});
