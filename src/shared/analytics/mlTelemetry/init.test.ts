// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Layout } from '@/core/types';

// Mock dependencies before importing the module under test
vi.mock('./eventBuffer');
vi.mock('./sessionState');
vi.mock('./trackers');

// Override DEV to false so initMLTelemetry exercises production code paths
vi.stubEnv('DEV', '');

import { setLayoutStoreRef, initMLTelemetry, cleanupMLTelemetry } from './init';
import * as eventBuffer from './eventBuffer';
import * as sessionState from './sessionState';
import * as trackers from './trackers';

describe('ML Telemetry Initialization', () => {
  let mockLayout: Layout;
  let mockGetState: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
    } as unknown as Layout;

    mockGetState = vi.fn(() => ({
      layout: mockLayout,
      lastEditSource: null,
    }));

    mockUnsubscribe = vi.fn();
    mockSubscribe = vi.fn((callback: unknown) => {
      // Store the callback so tests can invoke it
      mockSubscribe._lastCallback = callback;
      return mockUnsubscribe;
    }) as ReturnType<typeof vi.fn> & { _lastCallback?: unknown };

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
    it('stores references without throwing', () => {
      expect(() => setLayoutStoreRef(mockGetState, mockSubscribe)).not.toThrow();
    });
  });

  describe('initMLTelemetry', () => {
    it('returns a cleanup function', () => {
      const cleanup = initMLTelemetry();
      expect(typeof cleanup).toBe('function');
    });

    it('returns cleanup that calls cleanupMLTelemetry when already initialized', () => {
      initMLTelemetry();
      const secondCleanup = initMLTelemetry();
      // Second call returns cleanup for the already-initialized state
      expect(typeof secondCleanup).toBe('function');
      expect(() => secondCleanup()).not.toThrow();
    });

    it('allows re-initialization after cleanup', () => {
      initMLTelemetry();
      cleanupMLTelemetry();
      const cleanup = initMLTelemetry();
      expect(typeof cleanup).toBe('function');
    });

    it('subscribes to the layout store when setLayoutStoreRef was called', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();
      expect(mockSubscribe).toHaveBeenCalledOnce();
    });

    it('registers visibilitychange event listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      initMLTelemetry();

      const visibilityCalls = addSpy.mock.calls.filter(([event]) => event === 'visibilitychange');
      expect(visibilityCalls).toHaveLength(1);
    });

    it('registers pagehide event listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      initMLTelemetry();

      const pagehideCalls = addSpy.mock.calls.filter(([event]) => event === 'pagehide');
      expect(pagehideCalls).toHaveLength(1);
    });

    it('registers beforeunload event listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      initMLTelemetry();

      const beforeunloadCalls = addSpy.mock.calls.filter(([event]) => event === 'beforeunload');
      expect(beforeunloadCalls).toHaveLength(1);
    });
  });

  describe('store subscription', () => {
    it('calls markEditActivity and incrementEditCount for local edits', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();

      // Invoke the subscription callback with a local edit
      const callback = mockSubscribe._lastCallback as (state: {
        lastEditSource: string | null;
      }) => void;
      callback({ lastEditSource: 'local' });

      expect(sessionState.markEditActivity).toHaveBeenCalledOnce();
      expect(sessionState.incrementEditCount).toHaveBeenCalledOnce();
    });

    it('ignores non-local edit sources', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();

      const callback = mockSubscribe._lastCallback as (state: {
        lastEditSource: string | null;
      }) => void;
      callback({ lastEditSource: 'remote' });

      expect(sessionState.markEditActivity).not.toHaveBeenCalled();
      expect(sessionState.incrementEditCount).not.toHaveBeenCalled();
    });

    it('ignores null edit source', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();

      const callback = mockSubscribe._lastCallback as (state: {
        lastEditSource: string | null;
      }) => void;
      callback({ lastEditSource: null });

      expect(sessionState.markEditActivity).not.toHaveBeenCalled();
      expect(sessionState.incrementEditCount).not.toHaveBeenCalled();
    });
  });

  describe('visibilitychange handler', () => {
    it('tracks session summary and flushes when document becomes hidden', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });

      window.dispatchEvent(new Event('visibilitychange'));

      expect(trackers.trackSessionSummary).toHaveBeenCalledWith(mockLayout, 'session_end');
      expect(eventBuffer.flush).toHaveBeenCalled();
    });

    it('tracks layout snapshot when document hidden and layout is substantial', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(true);
      initMLTelemetry();

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });

      window.dispatchEvent(new Event('visibilitychange'));

      expect(trackers.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'session_end');
    });

    it('does not track layout snapshot when layout is not substantial', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(false);
      initMLTelemetry();

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });

      window.dispatchEvent(new Event('visibilitychange'));

      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('does nothing when document becomes visible', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });

      window.dispatchEvent(new Event('visibilitychange'));

      expect(trackers.trackSessionSummary).not.toHaveBeenCalled();
      expect(eventBuffer.flush).not.toHaveBeenCalled();
    });
  });

  describe('pagehide and beforeunload handlers', () => {
    it('flushes on pagehide', () => {
      initMLTelemetry();
      window.dispatchEvent(new Event('pagehide'));
      expect(eventBuffer.flush).toHaveBeenCalled();
    });

    it('flushes on beforeunload', () => {
      initMLTelemetry();
      window.dispatchEvent(new Event('beforeunload'));
      expect(eventBuffer.flush).toHaveBeenCalled();
    });
  });

  describe('idle detection', () => {
    it('checks idle state at the check interval', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();

      vi.advanceTimersByTime(60_000);

      expect(trackers.isEnabled).toHaveBeenCalled();
      expect(sessionState.getTimeSinceLastEdit).toHaveBeenCalled();
    });

    it('skips idle check when telemetry is disabled', () => {
      vi.mocked(trackers.isEnabled).mockReturnValue(false);
      initMLTelemetry();

      vi.advanceTimersByTime(60_000);

      expect(trackers.isEnabled).toHaveBeenCalled();
      expect(sessionState.getTimeSinceLastEdit).not.toHaveBeenCalled();
    });

    it('tracks layout snapshot when idle threshold reached and not yet tracked', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(5 * 60 * 1000);
      vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(true);
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(true);

      initMLTelemetry();
      vi.advanceTimersByTime(60_000);

      expect(trackers.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'idle');
    });

    it('does not track when idle threshold not reached', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(60_000);

      initMLTelemetry();
      vi.advanceTimersByTime(60_000);

      expect(sessionState.checkAndSetIdleTracked).not.toHaveBeenCalled();
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('does not track when already idle-tracked', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(5 * 60 * 1000);
      vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(false);

      initMLTelemetry();
      vi.advanceTimersByTime(60_000);

      expect(sessionState.checkAndSetIdleTracked).toHaveBeenCalled();
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('does not track when layout is not substantial', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      vi.mocked(sessionState.getTimeSinceLastEdit).mockReturnValue(5 * 60 * 1000);
      vi.mocked(sessionState.checkAndSetIdleTracked).mockReturnValue(true);
      vi.mocked(trackers.isSubstantialLayout).mockReturnValue(false);

      initMLTelemetry();
      vi.advanceTimersByTime(60_000);

      expect(trackers.isSubstantialLayout).toHaveBeenCalledWith(mockLayout);
      expect(trackers.trackLayoutSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('cleanupMLTelemetry', () => {
    it('can be called without prior initialization', () => {
      expect(() => cleanupMLTelemetry()).not.toThrow();
    });

    it('removes event listeners on cleanup', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      initMLTelemetry();
      cleanupMLTelemetry();

      const removedEvents = removeSpy.mock.calls.map(([event]) => event);
      expect(removedEvents).toContain('visibilitychange');
      expect(removedEvents).toContain('pagehide');
      expect(removedEvents).toContain('beforeunload');
    });

    it('calls store unsubscribe on cleanup', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();
      cleanupMLTelemetry();

      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('clears idle interval on cleanup', () => {
      setLayoutStoreRef(mockGetState, mockSubscribe);
      initMLTelemetry();
      cleanupMLTelemetry();

      vi.clearAllMocks();
      vi.advanceTimersByTime(120_000);

      // No idle checks should fire after cleanup
      expect(trackers.isEnabled).not.toHaveBeenCalled();
    });
  });
});
