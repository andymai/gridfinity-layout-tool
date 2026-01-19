import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetMLSession,
  getBufferSize,
  forceFlush,
} from '@/shared/analytics/mlTelemetry';

// Mock the settings store
vi.mock('@/core/store/settings', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: {
        mlTelemetryEnabled: true,
      },
    })),
  },
}));

describe('mlTelemetry', () => {
  beforeEach(() => {
    resetMLSession();
    // Clear any buffered events
    forceFlush();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resetMLSession', () => {
    it('resets session state without throwing', () => {
      expect(() => resetMLSession()).not.toThrow();
    });
  });

  describe('getBufferSize', () => {
    it('returns 0 for empty buffer', () => {
      forceFlush();
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('forceFlush', () => {
    it('clears the buffer', () => {
      forceFlush();
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('module exports', () => {
    it('exports expected functions', async () => {
      const module = await import('@/shared/analytics/mlTelemetry');

      expect(typeof module.initMLTelemetry).toBe('function');
      expect(typeof module.trackBinPlacement).toBe('function');
      expect(typeof module.trackLabelUpdate).toBe('function');
      expect(typeof module.trackBulkPlacement).toBe('function');
      expect(typeof module.resetMLSession).toBe('function');
      expect(typeof module.forceFlush).toBe('function');
      expect(typeof module.getBufferSize).toBe('function');
    });
  });
});
