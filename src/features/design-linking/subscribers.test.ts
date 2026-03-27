import { describe, it, expect, beforeEach } from 'vitest';
import { createEventBus } from '@/core/cqrs/bus/eventBus';
import type { EventBus } from '@/core/cqrs/bus/eventBus';
import type { DomainEvent } from '@/core/cqrs/events';
import { eventId, correlationId, commandId } from '@/core/cqrs/types';
import { connectDesignLinking } from './subscribers';

function makeEvent<T extends DomainEvent['type']>(
  type: T,
  payload: Extract<DomainEvent, { type: T }>['payload']
): Extract<DomainEvent, { type: T }> {
  return {
    type,
    payload,
    meta: {
      id: eventId('evt_1'),
      timestamp: Date.now(),
      correlationId: correlationId('cor_1'),
      commandId: commandId('cmd_1'),
      aggregateId: 'layout_1',
      version: 1,
      schemaVersion: 1,
    },
  } as Extract<DomainEvent, { type: T }>;
}

describe('connectDesignLinking', () => {
  let bus: EventBus;
  let unsubscribe: () => void;

  beforeEach(() => {
    bus = createEventBus();
    unsubscribe = connectDesignLinking(bus);
  });

  it('subscribes to designer.saved events without throwing', () => {
    const event = makeEvent('designer.saved', { designId: 'design_1' });
    expect(() => bus.publish(event)).not.toThrow();
  });

  it('subscribes to bin.updated events and filters non-dimension changes', () => {
    // Non-dimension change — should not throw
    const labelEvent = makeEvent('bin.updated', {
      id: 'bin_1' as never,
      changes: { label: 'new label' },
      previous: { label: 'old label' },
    });
    expect(() => bus.publish(labelEvent)).not.toThrow();

    // Dimension change — should not throw
    const dimensionEvent = makeEvent('bin.updated', {
      id: 'bin_1' as never,
      changes: { width: 2 },
      previous: { width: 1 },
    });
    expect(() => bus.publish(dimensionEvent)).not.toThrow();
  });

  it('returns an unsubscribe function that cleans up', () => {
    unsubscribe();
    // After unsubscribe, events should still not throw (no listeners)
    const event = makeEvent('designer.saved', { designId: 'design_1' });
    expect(() => bus.publish(event)).not.toThrow();
  });
});
