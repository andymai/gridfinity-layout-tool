import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus } from './eventBus';
import type { DomainEvent } from '../events';
import { eventId, correlationId, commandId } from '../types';
import { layoutId } from '@/core/types';

function makeEvent(type: DomainEvent['type'], version = 1): DomainEvent {
  return {
    type,
    payload: {},
    meta: {
      id: eventId(`evt_${Math.random()}`),
      timestamp: Date.now(),
      correlationId: correlationId('cor_1'),
      commandId: commandId('cmd_1'),
      aggregateId: layoutId('layout_1'),
      version,
    },
  } as DomainEvent;
}

describe('EventBus', () => {
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    bus = createEventBus();
  });

  it('delivers events to type-specific subscribers', () => {
    const handler = vi.fn();
    bus.subscribe('bin.added', handler);

    const event = makeEvent('bin.added');
    bus.publish(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not deliver events to wrong type subscribers', () => {
    const handler = vi.fn();
    bus.subscribe('bin.deleted', handler);

    bus.publish(makeEvent('bin.added'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers events to wildcard subscribers', () => {
    const handler = vi.fn();
    bus.subscribeAll(handler);

    const event = makeEvent('bin.added');
    bus.publish(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers to both typed and wildcard subscribers', () => {
    const typed = vi.fn();
    const wildcard = vi.fn();
    bus.subscribe('bin.added', typed);
    bus.subscribeAll(wildcard);

    const event = makeEvent('bin.added');
    bus.publish(event);

    expect(typed).toHaveBeenCalledTimes(1);
    expect(wildcard).toHaveBeenCalledTimes(1);
  });

  it('supports multiple subscribers for same type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.subscribe('bin.added', handler1);
    bus.subscribe('bin.added', handler2);

    bus.publish(makeEvent('bin.added'));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes correctly', () => {
    const handler = vi.fn();
    const unsub = bus.subscribe('bin.added', handler);

    bus.publish(makeEvent('bin.added'));
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    bus.publish(makeEvent('bin.added'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('publishes multiple events in order', () => {
    const events: DomainEvent[] = [];
    bus.subscribeAll((e) => events.push(e));

    const e1 = makeEvent('bin.added', 1);
    const e2 = makeEvent('bin.deleted', 2);
    const e3 = makeEvent('layer.added', 3);
    bus.publishAll([e1, e2, e3]);

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('bin.added');
    expect(events[1].type).toBe('bin.deleted');
    expect(events[2].type).toBe('layer.added');
  });

  it('clears all subscribers', () => {
    const handler = vi.fn();
    bus.subscribe('bin.added', handler);
    bus.subscribeAll(handler);

    bus.clear();
    bus.publish(makeEvent('bin.added'));

    expect(handler).not.toHaveBeenCalled();
  });
});
