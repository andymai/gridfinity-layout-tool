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
  trackSessionSummary,
  setLayoutStoreRef,
  incrementEditCount,
  markEditActivity,
  getSessionContext,
  cleanupMLTelemetry,
  trackBinResize,
  trackBinDeletion,
  trackBinMove,
  trackUndo,
  trackLayerMove,
  trackBinRotation,
  trackPlacementRejection,
  trackQuickCorrection,
  recordBinCreation,
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

  describe('trackBinResize', () => {
    it('buffers bin resize event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      trackBinResize({ width: 1, depth: 1 }, { width: 2, depth: 2 }, 3, layout);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('skips when sizes are the same', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      trackBinResize({ width: 2, depth: 2 }, { width: 2, depth: 2 }, 3, layout);
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('trackBinDeletion', () => {
    it('buffers bin deletion event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackBinDeletion(bin, layout, 'key');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('tracks batch size for bulk deletions', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackBinDeletion(bin, layout, 'bulk', 5);
      expect(getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('trackBinMove', () => {
    it('buffers bin move event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      // bin is at position (0,0), old position was (3,3)
      trackBinMove(bin, { x: 3, y: 3 }, layout, 'drag');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('skips when positions are the same', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      // bin is at (0,0) and old position is also (0,0)
      trackBinMove(bin, { x: 0, y: 0 }, layout, 'drag');
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('trackUndo', () => {
    it('buffers undo event when bins differ', () => {
      forceFlush();
      const prevLayout = createTestLayoutWithBins(5);
      const currLayout = createTestLayoutWithBins(4);
      trackUndo(prevLayout, currLayout);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('buffers undo event even when layouts are identical', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      trackUndo(layout, layout);
      // Still buffers event (action_undone = 'other')
      expect(getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('trackLayerMove', () => {
    it('buffers layer move event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackLayerMove(bin, 'layer-old', layout.layers[0].id, layout, 'drag');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('skips when layers are the same', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackLayerMove(bin, layout.layers[0].id, layout.layers[0].id, layout, 'drag');
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('trackBinRotation', () => {
    it('buffers bin rotation event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackBinRotation(bin);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('tracks batch rotations', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      trackBinRotation(bin, 3);
      expect(getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('trackPlacementRejection', () => {
    it('buffers placement rejection event', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      trackPlacementRejection('outside_bounds', 'draw', {
        start: { x: 0, y: 0 },
        current: { x: 2, y: 2 },
      }, layout, layout.layers[0].id);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('handles null interaction with cancelled reason', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      // cancelled reason bypasses intent check
      trackPlacementRejection('cancelled', 'paint', null, layout, layout.layers[0].id);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('skips when no intent and non-cancelled reason', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      // outside_bounds reason with null interaction = no intent = skip
      trackPlacementRejection('outside_bounds', 'paint', null, layout, layout.layers[0].id);
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('trackQuickCorrection', () => {
    it('buffers quick correction event when creation is recorded', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      // Record creation first
      recordBinCreation(bin.id, 'draw', '1x1x1');
      // Now track correction
      trackQuickCorrection('delete', bin.id, bin, layout);
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('skips when no creation record exists', () => {
      forceFlush();
      const layout = createTestLayoutWithBins(5);
      const bin = layout.bins[0];
      // Don't record creation
      trackQuickCorrection('resize', 'nonexistent-id', bin, layout, { width: 2, depth: 2, height: 2 });
      expect(getBufferSize()).toBe(0);
    });
  });

  describe('recordBinCreation', () => {
    it('records creation without throwing', () => {
      expect(() => recordBinCreation('bin-1', 'draw', '2x2x6')).not.toThrow();
    });
  });

  describe('cleanupMLTelemetry', () => {
    it('cleans up without throwing', () => {
      expect(() => cleanupMLTelemetry()).not.toThrow();
    });
  });

  describe('trackSessionSummary', () => {
    it('buffers session summary event when there is activity (layout_switch)', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(5);

      // Simulate some activity
      trackBinPlacement(layout.bins[0], layout, 'draw');
      trackBinPlacement(layout.bins[1], layout, 'draw');
      incrementEditCount();
      incrementEditCount();

      forceFlush();
      // Use layout_switch trigger which doesn't auto-flush
      trackSessionSummary(layout, 'layout_switch');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('session_end trigger flushes immediately', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(5);

      // Simulate some activity
      trackBinPlacement(layout.bins[0], layout, 'draw');
      incrementEditCount();

      forceFlush();
      // session_end trigger auto-flushes, so buffer will be empty after
      trackSessionSummary(layout, 'session_end');
      // Buffer should be empty after session_end (it flushed)
      expect(getBufferSize()).toBe(0);
    });

    it('skips session summary when no activity', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(5);

      // No activity - just create layout
      trackSessionSummary(layout, 'layout_switch');
      expect(getBufferSize()).toBe(0);
    });

    it('tracks size sequence from placements', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(5);

      // Place multiple bins
      trackBinPlacement(layout.bins[0], layout, 'draw');
      trackBinPlacement(layout.bins[1], layout, 'draw');
      trackBinPlacement(layout.bins[2], layout, 'draw');

      forceFlush();
      trackSessionSummary(layout, 'layout_switch');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('respects session state reset', () => {
      const layout = createTestLayoutWithBins(5);

      // First session
      trackBinPlacement(layout.bins[0], layout, 'draw');
      incrementEditCount();

      // Reset and start new session
      forceFlush();
      resetMLSession();

      // No activity in new session
      trackSessionSummary(layout, 'layout_switch');
      expect(getBufferSize()).toBe(0);
    });

    it('tracks session with many bins and edits', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(10);

      // Place many bins
      for (let i = 0; i < 10; i++) {
        trackBinPlacement(layout.bins[i], layout, 'draw');
        incrementEditCount();
      }

      forceFlush();
      trackSessionSummary(layout, 'layout_switch');
      expect(getBufferSize()).toBeGreaterThan(0);
    });

    it('tracks empty activity with only edit count', () => {
      forceFlush();
      resetMLSession();
      const layout = createTestLayoutWithBins(5);

      // Only increment edit count, no bin placements
      incrementEditCount();
      incrementEditCount();
      incrementEditCount();

      forceFlush();
      trackSessionSummary(layout, 'layout_switch');
      // Should still track because editCount > 0
      expect(getBufferSize()).toBeGreaterThan(0);
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
      expect(typeof module.trackSessionSummary).toBe('function');
      expect(typeof module.setLayoutStoreRef).toBe('function');
      expect(typeof module.incrementEditCount).toBe('function');
      expect(typeof module.markEditActivity).toBe('function');
      expect(typeof module.getSessionContext).toBe('function');
      expect(typeof module.resetMLSession).toBe('function');
      expect(typeof module.forceFlush).toBe('function');
      expect(typeof module.getBufferSize).toBe('function');
      expect(typeof module.cleanupMLTelemetry).toBe('function');
      expect(typeof module.trackBinResize).toBe('function');
      expect(typeof module.trackBinDeletion).toBe('function');
      expect(typeof module.trackBinMove).toBe('function');
      expect(typeof module.trackUndo).toBe('function');
      expect(typeof module.trackLayerMove).toBe('function');
      expect(typeof module.trackBinRotation).toBe('function');
      expect(typeof module.trackPlacementRejection).toBe('function');
      expect(typeof module.trackQuickCorrection).toBe('function');
      expect(typeof module.recordBinCreation).toBe('function');
    });
  });
});
