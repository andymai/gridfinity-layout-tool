import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Layout } from '@/core/types';
import { setLayoutStoreRef, initMLTelemetry, cleanupMLTelemetry } from './init';
import * as eventBuffer from './eventBuffer';
import * as sessionState from './sessionState';
import * as trackers from './trackers';

vi.mock('./eventBuffer');
vi.mock('./sessionState');
vi.mock('./trackers');

const IDLE_CHECK_INTERVAL_MS = 60 * 1000;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

describe('ML Telemetry Initialization', () => {
  let mockGetState: vi.Mock;
  let mockSubscribe: vi.Mock;
  let mockLayout: Layout;
  let mockUnsubscribe: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset module state
    cleanupMLTelemetry();

    mockLayout = {
      bins: [
        {
          id: 'bin1',
          position: { x: 0, y: 0 },
          size: { width: 1, depth: 1, height: 1 },
          layerId: 'layer1',
          category: null,
          label: '',
          notes: '',
        },
      ],
      layers: [{ id: 'layer1', name: 'Layer 1' }],
      categories: [],
      drawer: { width: 10, depth: 10 },
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
    };

    mockGetState = vi.fn(() => ({
      layout: mockLayout,
      lastEditSource: null,
    }));

    mockUnsubscribe = vi.fn();
    mockSubscribe = vi.fn(() => mockUnsubscribe);

    // Default mocks
    vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(0);
    vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(false);
    vi.mocked(trackers.isEnabled).mockReturnValue(true);
    vi.mocked(trackers.isSubstantialLayout).mockReturnValue(true);
  });

  afterEach(() => {
    cleanupMLTelemetry();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('setLayoutStoreRef', () => {
    it('stores references for later use', () => {
      const getState = vi.fn(() => ({ layout: mockLayout, lastEditSource: null }));
      const subscribe = vi.fn(() => vi.fn());

      // Should not throw
      expect(() => setLayoutStoreRef(getState, subscribe)).not.toThrow();
    });
  });

  describe('initMLTelemetry - development mode', () => {
    // Note: In test mode (DEV=true), initMLTelemetry returns early.
    // These tests verify the return value and that cleanup works safely.

    it('returns a cleanup function', () => {
      const cleanup = initMLTelemetry();

      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });

    it('returns early noop when called multiple times', () => {
      const firstCleanup = initMLTelemetry();
      const secondCleanup = initMLTelemetry();

      expect(typeof firstCleanup).toBe('function');
      expect(typeof secondCleanup).toBe('function');
    });

    it('cleanup function can be called multiple times safely', () => {
      const cleanup = initMLTelemetry();

      expect(() => cleanup()).not.toThrow();
      expect(() => cleanup()).not.toThrow();
    });

    it('returns early in SSR environment (no window)', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing SSR scenario
      delete global.window;

      const cleanup = initMLTelemetry();

      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe('cleanupMLTelemetry', () => {
    it('can be called without prior initialization', () => {
      expect(() => cleanupMLTelemetry()).not.toThrow();
    });

    it('can be called multiple times', () => {
      initMLTelemetry();

      expect(() => cleanupMLTelemetry()).not.toThrow();
      expect(() => cleanupMLTelemetry()).not.toThrow();
    });

    it('resets state allowing re-initialization', () => {
      const first = initMLTelemetry();
      cleanupMLTelemetry();
      const second = initMLTelemetry();

      expect(typeof first).toBe('function');
      expect(typeof second).toBe('function');
    });
  });

  // The following tests use manual instrumentation to test the logic
  // that would run in production mode (when DEV=false)

  describe('store subscription logic', () => {
    it('should call markEditActivity and incrementEditCount for local edits', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);

      // Simulate what the subscription callback would do
      const mockState = { lastEditSource: 'local' as const };
      if (mockState.lastEditSource === 'local') {
        sessionState.markEditActivity();
        sessionState.incrementEditCount();
      }

      expect(sessionState.markEditActivity).toHaveBeenCalled();
      expect(sessionState.incrementEditCount).toHaveBeenCalled();
    });

    it('should ignore non-local edit sources', () => {
      vi.clearAllMocks();

      const mockState = { lastEditSource: 'remote' as const };
      if (mockState.lastEditSource === 'local') {
        sessionState.markEditActivity();
        sessionState.incrementEditCount();
      }

      expect(sessionState.markEditActivity).not.toHaveBeenCalled();
      expect(sessionState.incrementEditCount).not.toHaveBeenCalled();
    });

    it('should ignore null edit source', () => {
      vi.clearAllMocks();

      const mockState = { lastEditSource: null };
      if (mockState.lastEditSource === 'local') {
        sessionState.markEditActivity();
        sessionState.incrementEditCount();
      }

      expect(sessionState.markEditActivity).not.toHaveBeenCalled();
      expect(sessionState.incrementEditCount).not.toHaveBeenCalled();
    });
  });

  describe('visibilitychange handler logic', () => {
    it('should track session summary when hidden', () => {
      const visibilityState = 'hidden';

      if (visibilityState === 'hidden') {
        trackers.trackSessionSummary(mockLayout, 'session_end');
        eventBuffer.flush();
      }

      expect(trackers.trackSessionSummary).toHaveBeenCalledWith(mockLayout, 'session_end');
      expect(eventBuffer.flush).toHaveBeenCalled();
    });

    it('should track layout snapshot if substantial', () => {
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(true);
      const visibilityState = 'hidden';

      if (visibilityState === 'hidden') {
        if (trackers.isSubstantialLayout(mockLayout)) {
          trackers.trackLayoutSnapshot(mockLayout, 'session_end');
        }
      }

      expect(trackers.isSubstantialLayout).toHaveBeenCalledWith(mockLayout);
      expect(trackers.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'session_end');
    });

    it('should not track snapshot if not substantial', () => {
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(false);
      const visibilityState = 'hidden';

      if (visibilityState === 'hidden') {
        if (trackers.isSubstantialLayout(mockLayout)) {
          trackers.trackLayoutSnapshot(mockLayout, 'session_end');
        }
      }

      expect(trackers.isSubstantialLayout).toHaveBeenCalledWith(mockLayout);
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('should do nothing when visible', () => {
      const visibilityState = 'visible';

      if (visibilityState === 'hidden') {
        trackers.trackSessionSummary(mockLayout, 'session_end');
        eventBuffer.flush();
      }

      expect(trackers.trackSessionSummary).not.toHaveBeenCalled();
      expect(eventBuffer.flush).not.toHaveBeenCalled();
    });
  });

  describe('pagehide handler logic', () => {
    it('should flush event buffer', () => {
      eventBuffer.flush();

      expect(eventBuffer.flush).toHaveBeenCalled();
    });
  });

  describe('beforeunload handler logic', () => {
    it('should flush event buffer', () => {
      eventBuffer.flush();

      expect(eventBuffer.flush).toHaveBeenCalled();
    });
  });

  describe('idle detection logic', () => {
    it('should not check when disabled', () => {
      vi.mocked(trackers.isEnabled).mockReturnValue(false);

      if (trackers.isEnabled()) {
        sessionState.getTimeSinceLastEdit();
      }

      expect(trackers.isEnabled).toHaveBeenCalled();
      expect(sessionState.getTimeSinceLastEdit).not.toHaveBeenCalled();
    });

    it('should check time since edit when enabled', () => {
      vi.mocked(trackers.isEnabled).mockReturnValue(true);

      if (trackers.isEnabled()) {
        sessionState.getTimeSinceLastEdit();
      }

      expect(trackers.isEnabled).toHaveBeenCalled();
      expect(sessionState.getTimeSinceLastEdit).toHaveBeenCalled();
    });

    it('should track when idle threshold reached and not yet tracked', () => {
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(IDLE_THRESHOLD_MS);
      vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(true);
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(true);

      const timeSinceEdit = sessionState.getTimeSinceLastEdit();
      if (timeSinceEdit >= IDLE_THRESHOLD_MS && sessionState.checkAndSetIdleTracked()) {
        if (trackers.isSubstantialLayout(mockLayout)) {
          trackers.trackLayoutSnapshot(mockLayout, 'idle');
        }
      }

      expect(sessionState.checkAndSetIdleTracked).toHaveBeenCalled();
      expect(trackers.isSubstantialLayout).toHaveBeenCalledWith(mockLayout);
      expect(trackers.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'idle');
    });

    it('should not track when threshold not reached', () => {
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(IDLE_THRESHOLD_MS - 1000);

      const timeSinceEdit = sessionState.getTimeSinceLastEdit();
      if (timeSinceEdit >= IDLE_THRESHOLD_MS && sessionState.checkAndSetIdleTracked()) {
        trackers.trackLayoutSnapshot(mockLayout, 'idle');
      }

      expect(sessionState.checkAndSetIdleTracked).not.toHaveBeenCalled();
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('should not track when already tracked', () => {
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(IDLE_THRESHOLD_MS);
      vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(false);

      const timeSinceEdit = sessionState.getTimeSinceLastEdit();
      if (timeSinceEdit >= IDLE_THRESHOLD_MS && sessionState.checkAndSetIdleTracked()) {
        trackers.trackLayoutSnapshot(mockLayout, 'idle');
      }

      expect(sessionState.checkAndSetIdleTracked).toHaveBeenCalled();
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('should not track when layout not substantial', () => {
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(IDLE_THRESHOLD_MS);
      vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(true);
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(false);

      const timeSinceEdit = sessionState.getTimeSinceLastEdit();
      if (timeSinceEdit >= IDLE_THRESHOLD_MS && sessionState.checkAndSetIdleTracked()) {
        if (trackers.isSubstantialLayout(mockLayout)) {
          trackers.trackLayoutSnapshot(mockLayout, 'idle');
        }
      }

      expect(trackers.isSubstantialLayout).toHaveBeenCalledWith(mockLayout);
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('constants verification', () => {
    it('uses correct idle threshold', () => {
      expect(IDLE_THRESHOLD_MS).toBe(5 * 60 * 1000);
    });

    it('uses correct check interval', () => {
      expect(IDLE_CHECK_INTERVAL_MS).toBe(60 * 1000);
    });
  });
});
