/**
 * Tests for the event persistence retry queue.
 *
 * Tests call _processRetries() directly to control timing,
 * rather than relying on setTimeout firing with fake timers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueueForRetry,
  getPendingRetryCount,
  clearRetryQueue,
  setRetryEventStore,
  _getPendingEntries,
  _processRetries,
} from './retryQueue';
import type { EventStore } from './eventStore';
import type { DomainEvent } from '../events';
import { eventId, correlationId, commandId } from '../types';
import { layoutId } from '@/core/types';
import { useToastStore } from '@/core/store/toast';

function makeEvent(type: DomainEvent['type'] = 'bin.added', id = 'evt_1'): DomainEvent {
  return {
    type,
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

function createMockStore(appendFn?: EventStore['append']): EventStore {
  return {
    append: appendFn ?? vi.fn().mockResolvedValue(undefined),
    getByAggregate: vi.fn(),
    getByTimeRange: vi.fn(),
    getByCorrelation: vi.fn(),
    count: vi.fn(),
    evict: vi.fn(),
    clear: vi.fn(),
  };
}

/** Force all entries to be ready for processing by backdating nextRetryAt. */
function makeAllReady(): void {
  for (const entry of _getPendingEntries()) {
    (entry as { nextRetryAt: number }).nextRetryAt = 0;
  }
}

describe('retryQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRetryQueue();
  });

  afterEach(() => {
    clearRetryQueue();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enqueues a failed event', () => {
    const store = createMockStore();
    setRetryEventStore(store);

    const event = makeEvent('bin.added', 'evt_enqueue');
    enqueueForRetry(event);

    expect(getPendingRetryCount()).toBe(1);
  });

  it('sets initial retry delay to BASE_DELAY_MS', () => {
    const store = createMockStore();
    setRetryEventStore(store);

    const now = Date.now();
    enqueueForRetry(makeEvent('bin.added', 'evt_delay'));

    const entries = _getPendingEntries();
    expect(entries).toHaveLength(1);
    // nextRetryAt should be ~1000ms from now (BASE_DELAY_MS)
    expect(entries[0].nextRetryAt - now).toBeGreaterThanOrEqual(1000);
    expect(entries[0].nextRetryAt - now).toBeLessThanOrEqual(1100);
    expect(entries[0].attempts).toBe(0);
  });

  it('removes event from queue on successful retry', async () => {
    const appendMock = vi.fn().mockResolvedValue(undefined);
    const store = createMockStore(appendMock);
    setRetryEventStore(store);

    const event = makeEvent('bin.added', 'evt_success');
    enqueueForRetry(event);
    expect(getPendingRetryCount()).toBe(1);

    // Make ready and process
    makeAllReady();
    await _processRetries();

    expect(appendMock).toHaveBeenCalledWith([event]);
    expect(getPendingRetryCount()).toBe(0);
  });

  it('drops event after max 3 attempts with warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const appendMock = vi.fn().mockRejectedValue(new Error('Persistent failure'));
    const store = createMockStore(appendMock);
    setRetryEventStore(store);

    const event = makeEvent('bin.deleted', 'evt_drop');
    enqueueForRetry(event);

    // Attempt 1
    makeAllReady();
    await _processRetries();
    expect(getPendingRetryCount()).toBe(1); // Still in queue, attempts=1

    // Attempt 2
    makeAllReady();
    await _processRetries();
    expect(getPendingRetryCount()).toBe(1); // Still in queue, attempts=2

    // Attempt 3 — should be dropped
    makeAllReady();
    await _processRetries();
    expect(getPendingRetryCount()).toBe(0); // Dropped

    // Should have logged a warning about dropping the event
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Event dropped after max retry attempts'),
      expect.objectContaining({
        eventType: 'bin.deleted',
        attempts: 3,
      })
    );

    warnSpy.mockRestore();
  });

  it('drops a disk-full failure immediately and surfaces a toast (no retries)', () => {
    const addToast = vi.fn();
    vi.spyOn(useToastStore, 'getState').mockReturnValue({ addToast } as never);
    const store = createMockStore();
    setRetryEventStore(store);

    enqueueForRetry(
      makeEvent('bin.added', 'evt_disk_full'),
      new Error('UnknownError: Internal error. (...::FILE_ERROR_NO_SPACE)')
    );

    // Permanent failure — never enters the retry queue.
    expect(getPendingRetryCount()).toBe(0);
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', duration: 0 }));
  });

  it('surfaces a toast when a transient failure is dropped after max attempts', async () => {
    const addToast = vi.fn();
    vi.spyOn(useToastStore, 'getState').mockReturnValue({ addToast } as never);
    const appendMock = vi.fn().mockRejectedValue(new Error('transient DB error'));
    const store = createMockStore(appendMock);
    setRetryEventStore(store);

    enqueueForRetry(makeEvent('bin.added', 'evt_transient_drop'));

    // Exhaust the retry budget.
    for (let i = 0; i < 3; i++) {
      makeAllReady();
      await _processRetries();
    }

    expect(getPendingRetryCount()).toBe(0);
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('stops retrying when a disk-full error surfaces mid-retry', async () => {
    const addToast = vi.fn();
    vi.spyOn(useToastStore, 'getState').mockReturnValue({ addToast } as never);
    const appendMock = vi.fn().mockRejectedValue(new Error('IO error: No space left on device'));
    const store = createMockStore(appendMock);
    setRetryEventStore(store);

    // Enqueued as transient (no error passed), then the first retry reveals the
    // permanent disk-full condition.
    enqueueForRetry(makeEvent('bin.added', 'evt_mid_retry_disk_full'));
    makeAllReady();
    await _processRetries();

    // Dropped on the first failure rather than retried twice more.
    expect(getPendingRetryCount()).toBe(0);
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('handles multiple events queued simultaneously', async () => {
    let callCount = 0;
    const appendMock = vi.fn().mockImplementation(() => {
      callCount++;
      // Second call fails (processing goes backwards through indices)
      if (callCount === 1) {
        return Promise.reject(new Error('Partial failure'));
      }
      return Promise.resolve(undefined);
    });
    const store = createMockStore(appendMock);
    setRetryEventStore(store);

    enqueueForRetry(makeEvent('bin.added', 'evt_multi_1'));
    enqueueForRetry(makeEvent('bin.deleted', 'evt_multi_2'));
    expect(getPendingRetryCount()).toBe(2);

    // Process both
    makeAllReady();
    await _processRetries();

    // One succeeded, one failed (still in queue for retry)
    expect(getPendingRetryCount()).toBe(1);
    expect(appendMock).toHaveBeenCalledTimes(2);
  });

  it('clearRetryQueue removes all entries and cancels timer', () => {
    const store = createMockStore();
    setRetryEventStore(store);

    enqueueForRetry(makeEvent('bin.added', 'evt_clear_1'));
    enqueueForRetry(makeEvent('bin.deleted', 'evt_clear_2'));
    expect(getPendingRetryCount()).toBe(2);

    clearRetryQueue();

    expect(getPendingRetryCount()).toBe(0);
  });

  it('drops all entries when no store is configured', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // clearRetryQueue resets the store reference
    clearRetryQueue();

    // Re-enqueue without setting a store
    const entries = _getPendingEntries() as unknown as Array<{
      event: DomainEvent;
      attempts: number;
      nextRetryAt: number;
    }>;
    entries.push({
      event: makeEvent('bin.added', 'evt_no_store'),
      attempts: 0,
      nextRetryAt: 0,
    });

    await _processRetries();

    // All entries should be dropped
    expect(getPendingRetryCount()).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No event store configured'),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it('exponential backoff doubles delay on each failure', async () => {
    const appendMock = vi.fn().mockRejectedValue(new Error('DB error'));
    const store = createMockStore(appendMock);
    setRetryEventStore(store);

    enqueueForRetry(makeEvent('bin.added', 'evt_timing'));

    // Process attempt 1
    makeAllReady();
    await _processRetries();

    const entries = _getPendingEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(1);

    // After first failure: backoff = BASE_DELAY * 2^0 = 1000ms
    const now1 = Date.now();
    const delay1 = entries[0].nextRetryAt - now1;
    expect(delay1).toBeGreaterThanOrEqual(900);
    expect(delay1).toBeLessThanOrEqual(1100);

    // Process attempt 2
    makeAllReady();
    await _processRetries();

    expect(entries[0].attempts).toBe(2);

    // After second failure: backoff = BASE_DELAY * 2^1 = 2000ms
    const now2 = Date.now();
    const delay2 = entries[0].nextRetryAt - now2;
    expect(delay2).toBeGreaterThanOrEqual(1900);
    expect(delay2).toBeLessThanOrEqual(2100);
  });

  it('schedules processing via setTimeout', () => {
    const store = createMockStore();
    setRetryEventStore(store);

    enqueueForRetry(makeEvent('bin.added', 'evt_timer'));

    // Timer should be set (we can verify by checking that advancing time triggers processing)
    expect(getPendingRetryCount()).toBe(1);

    // The timer should exist but not have fired yet
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);
  });
});
