import type { MLTelemetryEvent } from './types';
import { useSettingsStore } from '@/core/store/settings';

// Telemetry client version for tracking schema/protocol changes
// Separate from app version - increment when telemetry format changes
const CLIENT_VERSION = '0.1.0';

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const FLUSH_THRESHOLD = 20; // or 20 events

// Sampling: After this many bins, start sampling at 25% rate
export const SAMPLING_THRESHOLD = 50;
export const SAMPLING_RATE = 0.25;

// Circuit breaker: Stop sending after this many consecutive failures
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // 5 minutes

let eventBuffer: MLTelemetryEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

// Circuit breaker state
let consecutiveFailures = 0;
let circuitBreakerTrippedAt: number | null = null;

/**
 * Buffer a telemetry event and schedule/trigger a flush.
 *
 * This is the common exit path for all tracking functions.
 * Adds the event to the buffer and either flushes immediately
 * if threshold is reached, or schedules a deferred flush.
 *
 * @param event - The telemetry event to buffer
 * @param immediate - If true, flush immediately regardless of threshold
 */
export function bufferEvent(event: MLTelemetryEvent, immediate = false): void {
  eventBuffer.push(event);

  if (immediate || eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Schedule a future buffer flush if one is not already pending.
 */
function scheduleFlush(): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Cancels any scheduled telemetry flush.
 */
function cancelFlush(): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

/**
 * Determine whether the telemetry circuit breaker is currently open.
 */
function isCircuitBreakerOpen(): boolean {
  if (consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) {
    return false;
  }

  // Check if enough time has passed to reset
  if (circuitBreakerTrippedAt !== null) {
    const elapsed = Date.now() - circuitBreakerTrippedAt;
    if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
      consecutiveFailures = 0;
      circuitBreakerTrippedAt = null;
      return false;
    }
  }

  return true;
}

/**
 * Record a successful send (resets circuit breaker).
 */
function recordSuccess(): void {
  consecutiveFailures = 0;
  circuitBreakerTrippedAt = null;
}

/**
 * Record a failed telemetry send and trip the circuit breaker when threshold is reached.
 */
function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && circuitBreakerTrippedAt === null) {
    circuitBreakerTrippedAt = Date.now();
  }
}

/**
 * Sends buffered ML telemetry events to the server and clears the local buffer.
 */
export function flush(): void {
  cancelFlush();

  if (eventBuffer.length === 0) return;

  // Check if analytics/telemetry is still enabled
  const settings = useSettingsStore.getState().settings;
  if (!settings.analyticsEnabled) {
    eventBuffer = [];
    return;
  }

  // Check circuit breaker
  if (isCircuitBreakerOpen()) {
    eventBuffer = [];
    return;
  }

  const events = eventBuffer;
  eventBuffer = [];

  // Add client_version to all events for schema tracking
  const eventsWithVersion = events.map((event) => ({
    ...event,
    client_version: CLIENT_VERSION,
  }));

  // Use sendBeacon for reliability on page close
  try {
    const blob = new Blob([JSON.stringify(eventsWithVersion)], { type: 'application/json' });
    const sent = navigator.sendBeacon('/api/ml-telemetry', blob);

    if (sent) {
      recordSuccess();
    } else {
      // Fallback to fetch if sendBeacon fails
      fetch('/api/ml-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventsWithVersion),
        keepalive: true,
      })
        .then((response) => {
          if (response.ok) {
            recordSuccess();
          } else {
            recordFailure();
          }
        })
        .catch(() => {
          recordFailure();
        });
    }
  } catch {
    recordFailure();
  }
}

/**
 * Get current buffer size (for debugging/testing).
 */
export function getBufferSize(): number {
  return eventBuffer.length;
}
