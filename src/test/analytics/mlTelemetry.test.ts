import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetMLSession,
  getBufferSize,
  forceFlush,
  trackLayoutSnapshot,
  trackQualitySignal,
  trackDrawerPurpose,
  setLayoutStoreRef,
  incrementEditCount,
  markEditActivity,
  getSessionContext,
} from '@/shared/analytics/mlTelemetry';
import type { Layout } from '@/core/types';
import { createDefaultLayout } from '@/core/constants';

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

// Helper to create a test layout with bins
function createTestLayoutWithBins(binCount: number): Layout {
  const layout = createDefaultLayout();
  layout.bins = [];
  for (let i = 0; i < binCount; i++) {
    layout.bins.push({
      id: `bin-${i}`,
      x: i % layout.drawer.width,
      y: Math.floor(i / layout.drawer.width),
      width: 1,
      depth: 1,
      height: 1,
      layerId: layout.layers[0].id,
      category: layout.categories[0].id,
      label: i % 2 === 0 ? `Label ${i}` : undefined,
    });
  }
  return layout;
}

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

  describe('trackLayoutSnapshot', () => {
    it('buffers layout snapshot event for substantial layouts', () => {
      const layout = createTestLayoutWithBins(10);
      trackLayoutSnapshot(layout, 'save');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('buffers snapshot even for small layouts (filtering at trigger points)', () => {
      // Note: Quality filtering is done at trigger points (session_end, idle),
      // not in trackLayoutSnapshot itself. This allows explicit triggers
      // like 'save' to always capture data.
      const layout = createTestLayoutWithBins(2);
      trackLayoutSnapshot(layout, 'save');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('rate limits snapshots for same layout', () => {
      const layout = createTestLayoutWithBins(10);
      trackLayoutSnapshot(layout, 'save');
      const firstSize = getBufferSize();

      // Second call should be rate limited (same layout hash within 60s)
      trackLayoutSnapshot(layout, 'save');
      expect(getBufferSize()).toBe(firstSize);
    });

    it('allows share and print triggers to bypass rate limit', () => {
      const layout = createTestLayoutWithBins(10);
      trackLayoutSnapshot(layout, 'share');
      const firstSize = getBufferSize();

      trackLayoutSnapshot(layout, 'share');
      expect(getBufferSize()).toBeGreaterThan(firstSize);
    });
  });

  describe('trackQualitySignal', () => {
    it('buffers quality signal event', () => {
      const layout = createTestLayoutWithBins(5);
      trackQualitySignal(layout, 'shared');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('tracks days since creation when provided', () => {
      const layout = createTestLayoutWithBins(5);
      const createdAt = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
      trackQualitySignal(layout, 'exported', createdAt);
      expect(getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('trackDrawerPurpose', () => {
    it('buffers drawer purpose event', () => {
      const layout = createTestLayoutWithBins(5);
      trackDrawerPurpose(layout, 'workshop');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('tracks custom purpose flag', () => {
      const layout = createTestLayoutWithBins(5);
      trackDrawerPurpose(layout, 'my-custom-drawer', true);
      expect(getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('setLayoutStoreRef', () => {
    it('sets store reference without throwing', () => {
      const mockGetState = vi.fn(() => ({
        layout: createDefaultLayout(),
        lastEditSource: null,
      }));
      const mockSubscribe = vi.fn(() => () => {});

      expect(() => setLayoutStoreRef(mockGetState, mockSubscribe)).not.toThrow();
    });
  });

  describe('session tracking', () => {
    it('increments edit count', () => {
      const initial = getSessionContext().editCount;
      incrementEditCount();
      expect(getSessionContext().editCount).toBe(initial + 1);
    });

    it('marks edit activity without throwing', () => {
      expect(() => markEditActivity()).not.toThrow();
    });

    it('returns session context with duration and edit count', () => {
      const context = getSessionContext();
      expect(typeof context.durationMs).toBe('number');
      expect(typeof context.editCount).toBe('number');
      expect(context.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('module exports', () => {
    it('exports expected functions', async () => {
      const module = await import('@/shared/analytics/mlTelemetry');

      expect(typeof module.initMLTelemetry).toBe('function');
      expect(typeof module.trackBinPlacement).toBe('function');
      expect(typeof module.trackLabelUpdate).toBe('function');
      expect(typeof module.trackBulkPlacement).toBe('function');
      expect(typeof module.trackLayoutSnapshot).toBe('function');
      expect(typeof module.trackQualitySignal).toBe('function');
      expect(typeof module.trackDrawerPurpose).toBe('function');
      expect(typeof module.setLayoutStoreRef).toBe('function');
      expect(typeof module.incrementEditCount).toBe('function');
      expect(typeof module.markEditActivity).toBe('function');
      expect(typeof module.getSessionContext).toBe('function');
      expect(typeof module.resetMLSession).toBe('function');
      expect(typeof module.forceFlush).toBe('function');
      expect(typeof module.getBufferSize).toBe('function');
    });
  });
});
