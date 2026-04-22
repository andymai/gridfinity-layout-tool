/**
 * Tests for the event store's append behavior.
 *
 * Critical invariant: `append` must be idempotent for retries. When the retry
 * queue re-appends an event whose original write actually landed in IndexedDB
 * (but whose promise rejected due to a connection drop), the second write
 * MUST NOT throw — otherwise the retry queue drops the event silently.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eventStore } from './eventStore';
import type { DomainEvent } from '../events';
import { eventId, correlationId, commandId } from '../types';
import { layoutId } from '@/core/types';

function makeEvent(id = 'evt_test'): DomainEvent {
  return {
    type: 'bin.added',
    payload: {},
    meta: {
      id: eventId(id),
      timestamp: Date.now(),
      correlationId: correlationId('cor_1'),
      commandId: commandId('cmd_1'),
      aggregateId: layoutId('layout_1'),
      version: 1,
      schemaVersion: 1,
    },
  } as DomainEvent;
}

describe('eventStore.append', () => {
  beforeEach(async () => {
    await eventStore.clear();
  });

  it('is idempotent when the same event id is appended twice', async () => {
    const event = makeEvent('evt_duplicate');

    await eventStore.append([event]);
    // Must NOT throw — a retry of an already-persisted event would otherwise
    // hit a ConstraintError on the `meta.id` keyPath and the retry queue
    // would misclassify it as a transient failure.
    await expect(eventStore.append([event])).resolves.toBeUndefined();

    expect(await eventStore.count(event.meta.aggregateId)).toBe(1);
  });

  it('persists a new event and reads it back by aggregate', async () => {
    const event = makeEvent('evt_new');
    await eventStore.append([event]);

    const events = await eventStore.getByAggregate(event.meta.aggregateId);
    expect(events).toHaveLength(1);
    expect(events[0].meta.id).toBe(event.meta.id);
  });
});
