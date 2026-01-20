import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetMLSession,
  getBufferSize,
  forceFlush,
  trackBinPlacement,
  trackLabelUpdate,
  trackBulkPlacement,
  trackLayoutSnapshot,
  trackQualitySignal,
  trackDrawerPurpose,
  setLayoutStoreRef,
  incrementEditCount,
  markEditActivity,
  getSessionContext,
  cleanupMLTelemetry,
} from '@/shared/analytics/mlTelemetry';
import { mlTracking } from '@/shared/analytics/useMLTracking';
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

// Mock the layout store for mlTracking tests
vi.mock('@/core/store/layout', () => ({
  useLayoutStore: {
    getState: vi.fn(() => ({
      layout: {
        drawer: { width: 10, depth: 8, height: 12 },
        bins: [],
        layers: [{ id: 'layer-1', name: 'Layer 1', height: 6 }],
        categories: [{ id: 'cat-1', name: 'Default', color: '#888888' }],
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
      },
    })),
    subscribe: vi.fn(() => () => {}),
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

  describe('trackBinPlacement', () => {
    it('buffers bin placement event', () => {
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackBinPlacement(bin, layout, 'draw');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('tracks session index incrementing', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(5);
      const bin1 = layout.bins[0];
      const bin2 = layout.bins[1];
      trackBinPlacement(bin1, layout, 'draw');
      trackBinPlacement(bin2, layout, 'draw');
      expect(getBufferSize()).toBe(2);
    });
  });

  describe('trackLabelUpdate', () => {
    it('buffers label update event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackLabelUpdate(bin, 'old label', 'new label');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('skips when labels are the same', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackLabelUpdate(bin, 'same label', 'same label');
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('trackBulkPlacement', () => {
    it('buffers sampled events from bulk placement', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(20);
      trackBulkPlacement(layout.bins, layout, 'fill');
      // Samples up to 5 bins from larger sets
      expect(getBufferSize()).toBeLessThanOrEqual(5);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('handles empty array', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(0);
      trackBulkPlacement([], layout, 'fill');
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('cleanupMLTelemetry', () => {
    it('cleans up without throwing', () => {
      expect(() => cleanupMLTelemetry()).not.toThrow();
    });
  });

  describe('mlTracking object', () => {
    const testBin = {
      id: 'test-bin',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
      layerId: 'layer-1',
      category: 'cat-1',
      label: 'Test Bin',
    };

    it('trackPlacement tracks a single bin', () => {
      forceFlush();
      mlTracking.trackPlacement(testBin, 'draw');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('trackLabel tracks label updates', () => {
      forceFlush();
      mlTracking.trackLabel(testBin, 'old', 'new');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('trackBulk tracks multiple bins', () => {
      forceFlush();
      mlTracking.trackBulk([testBin], 'fill');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('trackSnapshot tracks layout snapshots', () => {
      forceFlush();
      mlTracking.trackSnapshot('save');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('trackQuality tracks quality signals', () => {
      forceFlush();
      mlTracking.trackQuality('shared');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('trackPurpose tracks drawer purpose', () => {
      forceFlush();
      mlTracking.trackPurpose('workshop');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('incrementEdit increments edit count', () => {
      const before = getSessionContext().editCount;
      mlTracking.incrementEdit();
      expect(getSessionContext().editCount).toBe(before + 1);
    });

    it('markActivity marks edit activity', () => {
      expect(() => mlTracking.markActivity()).not.toThrow();
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
      expect(typeof module.cleanupMLTelemetry).toBe('function');
    });
  });
});
