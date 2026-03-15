/**
 * Retry Queue — Exponential backoff for failed event persistence.
 *
 * When IndexedDB `append()` fails, events are enqueued here for
 * async retry. This is fire-and-forget — it never blocks the
 * command pipeline.
 *
 * After MAX_ATTEMPTS the event is dropped and a structured warning
 * is logged. Events are retried via setTimeout (non-blocking).
 */

import type { DomainEvent } from '../events';
import { createLogger } from '@/core/logger';
import type { EventStore } from './eventStore';

const log = createLogger('RetryQueue');

interface RetryEntry {
  event: DomainEvent;
  attempts: number;
  nextRetryAt: number;
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

const pendingRetries: RetryEntry[] = [];
let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** The target time the current timer is scheduled for */
let retryTimerTarget: number | null = null;

/**
 * The event store instance used for retries.
 * Set via `setRetryEventStore()` during initialization.
 */
let retryTarget: EventStore | null = null;

/** Wire up the event store that retries will append to. */
export function setRetryEventStore(store: EventStore): void {
  retryTarget = store;
}

/** Add a failed event to the retry queue. */
export function enqueueForRetry(event: DomainEvent): void {
  const delay = BASE_DELAY_MS;
  pendingRetries.push({
    event,
    attempts: 0,
    nextRetryAt: Date.now() + delay,
  });

  log.debug('Event enqueued for retry', {
    eventType: event.type,
    eventId: event.meta.id,
    queueSize: pendingRetries.length,
  });

  scheduleProcessing();
}

/**
 * Schedule the next retry processing pass.
 * Uses the earliest `nextRetryAt` in the queue to set the timer.
 * If a new entry has an earlier nextRetryAt than the pending timer,
 * the timer is cancelled and rescheduled for the earlier time.
 */
function scheduleProcessing(): void {
  if (pendingRetries.length === 0) return;

  // Find the earliest retry time
  let earliestRetry = Infinity;
  for (const entry of pendingRetries) {
    if (entry.nextRetryAt < earliestRetry) {
      earliestRetry = entry.nextRetryAt;
    }
  }

  // If a timer is already scheduled for an earlier or equal time, keep it
  if (retryTimer !== null && retryTimerTarget !== null && retryTimerTarget <= earliestRetry) {
    return;
  }

  // Cancel the existing timer if the new target is earlier
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
  }

  retryTimerTarget = earliestRetry;
  const delay = Math.max(0, earliestRetry - Date.now());
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryTimerTarget = null;
    void processRetries();
  }, delay);
}

/**
 * Process all entries whose `nextRetryAt` has passed.
 * Successful retries are removed; failed ones get re-enqueued
 * with exponential backoff or dropped after MAX_ATTEMPTS.
 */
async function processRetries(): Promise<void> {
  if (!retryTarget) {
    log.warn('No event store configured for retry queue — dropping all entries', {
      count: pendingRetries.length,
    });
    pendingRetries.length = 0;
    return;
  }

  const now = Date.now();
  // Collect indices of entries ready to process (iterate backwards for safe splice)
  const readyIndices: number[] = [];
  for (let i = 0; i < pendingRetries.length; i++) {
    if (pendingRetries[i].nextRetryAt <= now) {
      readyIndices.push(i);
    }
  }

  // Process ready entries (splice backwards to preserve indices)
  for (let i = readyIndices.length - 1; i >= 0; i--) {
    const index = readyIndices[i];
    const entry = pendingRetries[index];
    entry.attempts += 1;

    try {
      await retryTarget.append([entry.event]);
      // Success — remove from queue
      pendingRetries.splice(index, 1);
      log.debug('Retry succeeded', {
        eventType: entry.event.type,
        eventId: entry.event.meta.id,
        attempt: entry.attempts,
      });
    } catch (error: unknown) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        // Max attempts reached — drop the event
        pendingRetries.splice(index, 1);
        log.warn('Event dropped after max retry attempts', {
          eventType: entry.event.type,
          eventId: entry.event.meta.id,
          attempts: entry.attempts,
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        // Schedule next retry with exponential backoff
        const backoffDelay = BASE_DELAY_MS * Math.pow(2, entry.attempts - 1);
        entry.nextRetryAt = Date.now() + backoffDelay;
        log.debug('Retry failed, will retry again', {
          eventType: entry.event.type,
          eventId: entry.event.meta.id,
          attempt: entry.attempts,
          nextRetryIn: `${String(backoffDelay)}ms`,
        });
      }
    }
  }

  // Schedule next pass if there are still entries
  scheduleProcessing();
}

// === Test helpers ===

/** Get the number of events awaiting retry. */
export function getPendingRetryCount(): number {
  return pendingRetries.length;
}

/** Clear the retry queue and cancel any pending timer. */
export function clearRetryQueue(): void {
  pendingRetries.length = 0;
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryTimerTarget = null;
  retryTarget = null;
}

/** Exposed for testing — the internal entries array. */
export function _getPendingEntries(): ReadonlyArray<Readonly<RetryEntry>> {
  return pendingRetries;
}

/** Exposed for testing — trigger processing immediately. */
export function _processRetries(): Promise<void> {
  return processRetries();
}
