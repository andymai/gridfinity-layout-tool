// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Bin, Category, Drawer, Layer, LayerId, Layout } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId, mm } from '@/core/types';
import {
  computeLayoutMetrics,
  computeLabsMetrics,
  getDeviceType,
  trackLayoutSnapshot,
  trackEvent,
  track3DPreview,
  trackLayoutAction,
  trackFillOperation,
  trackPaintMode,
  initAnalytics,
  listenForPwaInstall,
  captureUtmParameters,
} from '@/shared/analytics/posthog';
import { useLabsStore } from '@/core/store';
import { createDefaultLabsPreferences } from '@/core/labs';
import { STAGING_ID } from '@/core/constants';
import { createTestLayout as baseCreateTestLayout } from '@/test/testUtils';

const makeDrawer = (
  width: number,
  depth: number,
  height: number,
  extra?: Omit<Drawer, 'width' | 'depth' | 'height'>
): Drawer => ({
  width: gridUnits(width),
  depth: gridUnits(depth),
  height: heightUnits(height),
  ...extra,
});

const makeLayer = (id: string, name: string, height: number): Layer => ({
  id: layerId(id),
  name,
  height: heightUnits(height),
});

const makeCategory = (id: string, name: string, color: string): Category => ({
  id: categoryId(id),
  name,
  color,
});

interface BinSpec {
  id: string;
  layerId?: LayerId;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  category?: string;
  label?: string;
  notes?: string;
  clearanceHeight?: number;
}

const makeBin = ({ clearanceHeight, ...spec }: BinSpec): Bin => ({
  id: binId(spec.id),
  layerId: spec.layerId ?? layerId('layer1'),
  x: gridUnits(spec.x),
  y: gridUnits(spec.y),
  width: gridUnits(spec.width),
  depth: gridUnits(spec.depth),
  height: heightUnits(spec.height),
  category: categoryId(spec.category ?? 'coral'),
  label: spec.label ?? '',
  notes: spec.notes ?? '',
  ...(clearanceHeight === undefined ? {} : { clearanceHeight: heightUnits(clearanceHeight) }),
});

const setEnabledFeatures = (enabledFeatures: Record<string, boolean>): void => {
  useLabsStore.setState({
    preferences: { ...createDefaultLabsPreferences(), enabledFeatures },
  });
};

const createTestLayout = (overrides?: Partial<Layout>): Layout =>
  baseCreateTestLayout({
    categories: [
      makeCategory('coral', 'Coral', '#FF6B6B'),
      makeCategory('custom1', 'My Custom Category', '#00FF00'),
    ],
    layers: [makeLayer('layer1', 'Layer 1', 3)],
    ...overrides,
  });

describe('computeLayoutMetrics', () => {
  describe('drawer configuration', () => {
    it('captures drawer dimensions', () => {
      const layout = createTestLayout({
        drawer: makeDrawer(15, 12, 18),
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.drawer_width).toBe(15);
      expect(metrics.drawer_depth).toBe(12);
      expect(metrics.drawer_height).toBe(18);
    });

    it('captures grid settings', () => {
      const layout = createTestLayout({
        gridUnitMm: mm(50),
        heightUnitMm: mm(10),
        printBedSize: mm(300),
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.grid_unit_mm).toBe(50);
      expect(metrics.height_unit_mm).toBe(10);
      expect(metrics.print_bed_size).toBe(300);
    });

    it('detects default drawer', () => {
      const defaultLayout = createTestLayout({
        drawer: makeDrawer(10, 8, 12),
      });
      expect(computeLayoutMetrics(defaultLayout).drawer_is_default).toBe(true);

      const customLayout = createTestLayout({
        drawer: makeDrawer(15, 10, 12),
      });
      expect(computeLayoutMetrics(customLayout).drawer_is_default).toBe(false);
    });

    it('reports rectangular drawers as unshaped', () => {
      const metrics = computeLayoutMetrics(createTestLayout());

      expect(metrics.feature_shaped_drawer).toBe(false);
      expect(metrics.drawer_shape_kind).toBe('rectangle');
    });

    it('flags layouts with a stored measured drawer size', () => {
      expect(computeLayoutMetrics(createTestLayout()).feature_measured_mm).toBe(false);

      const layout = createTestLayout({
        drawer: makeDrawer(10, 8, 12, { measuredMm: { width: 450, depth: 380 } }),
      });
      expect(computeLayoutMetrics(layout).feature_measured_mm).toBe(true);
    });

    // A chamfered front-left corner — non-rectangular, so setDrawerOutline's
    // isRectangleEquivalent normalization would NOT strip it. Exact-rectangle
    // outlines never survive a write and would test an unreachable state.
    const chamferedVertices = [
      { x: 21, y: 0 },
      { x: 420, y: 0 },
      { x: 420, y: 336 },
      { x: 0, y: 336 },
      { x: 0, y: 21 },
    ];

    it('captures the authoring kind of a shaped drawer', () => {
      const layout = createTestLayout({
        drawer: makeDrawer(10, 8, 12, {
          outline: {
            vertices: chamferedVertices,
            authoring: { kind: 'corners' },
          },
        }),
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.feature_shaped_drawer).toBe(true);
      expect(metrics.drawer_shape_kind).toBe('corners');
    });

    it('reports outlines with a stripped authoring annotation as custom', () => {
      const layout = createTestLayout({
        drawer: makeDrawer(10, 8, 12, {
          outline: {
            vertices: chamferedVertices,
          },
        }),
      });

      expect(computeLayoutMetrics(layout).drawer_shape_kind).toBe('custom');
    });
  });

  describe('bin statistics', () => {
    it('counts total bins', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin3', layerId: STAGING_ID, x: 0, y: 0, width: 1, depth: 1, height: 3 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_count).toBe(3);
      expect(metrics.bins_on_grid).toBe(2);
      expect(metrics.bins_in_staging).toBe(1);
    });

    it('counts bins with labels', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'Screws' }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin3', x: 4, y: 0, width: 2, depth: 2, height: 3, label: '  ' }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_labels).toBe(1);
    });

    it('counts bins with notes', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3, notes: 'M3 screws' }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_notes).toBe(1);
    });

    it('counts bins with clearance height', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3, clearanceHeight: 2 }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3, clearanceHeight: 0 }),
          makeBin({ id: 'bin3', x: 4, y: 0, width: 2, depth: 2, height: 3 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_clearance).toBe(1);
    });

    it('counts bins with half-unit dimensions', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0.5, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 1.5, depth: 2, height: 3 }),
          makeBin({ id: 'bin3', x: 4, y: 0, width: 2, depth: 2, height: 3 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_half_units).toBe(2);
    });

    it('calculates average bin area', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3 }), // 4
          makeBin({ id: 'bin2', x: 2, y: 0, width: 3, depth: 2, height: 3 }), // 6
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_avg_area).toBe(5); // (4 + 6) / 2
    });

    it('returns 0 average area for empty layout', () => {
      const layout = createTestLayout({ bins: [] });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_avg_area).toBe(0);
    });

    it('tracks top bin sizes', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin3', x: 4, y: 0, width: 1, depth: 1, height: 3 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_top_sizes[0]).toEqual({ size: '2x2', count: 2 });
      expect(metrics.bin_top_sizes[1]).toEqual({ size: '1x1', count: 1 });
    });

    it('tracks bin height distribution', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin3', x: 4, y: 0, width: 2, depth: 2, height: 6 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_heights).toEqual({ 3: 2, 6: 1 });
    });
  });

  describe('layer statistics', () => {
    it('counts layers', () => {
      const layout = createTestLayout({
        layers: [makeLayer('layer1', 'Layer 1', 3), makeLayer('layer2', 'Layer 2', 6)],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.layer_count).toBe(2);
    });

    it('captures layer heights', () => {
      const layout = createTestLayout({
        layers: [makeLayer('layer1', 'Layer 1', 3), makeLayer('layer2', 'Layer 2', 6)],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.layer_heights).toEqual([3, 6]);
      expect(metrics.layer_total_height).toBe(9);
    });
  });

  describe('category statistics', () => {
    it('counts categories', () => {
      const layout = createTestLayout();
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.category_count).toBe(2);
    });

    it('counts custom categories (non-default)', () => {
      // Default categories are: Coral, Sky, Green, Cloud, Charcoal
      const layout = createTestLayout({
        categories: [
          makeCategory('coral', 'Coral', '#FF6B6B'), // default
          makeCategory('sky', 'Sky', '#38bdf8'), // default
          makeCategory('custom1', 'My Screws', '#00FF00'), // custom
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.custom_category_count).toBe(1);
    });

    it('tracks top categories by bin count', () => {
      const layout = createTestLayout({
        categories: [
          makeCategory('coral', 'Coral', '#FF6B6B'),
          makeCategory('sky', 'Sky', '#38bdf8'),
        ],
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2, height: 3 }),
          makeBin({ id: 'bin3', x: 4, y: 0, width: 2, depth: 2, height: 3, category: 'sky' }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.top_categories[0]).toEqual({ name: 'Coral', count: 2 });
      expect(metrics.top_categories[1]).toEqual({ name: 'Sky', count: 1 });
    });
  });

  describe('feature flags', () => {
    it('detects multi-layer usage', () => {
      const singleLayer = createTestLayout({
        layers: [makeLayer('layer1', 'Layer 1', 3)],
      });
      expect(computeLayoutMetrics(singleLayer).feature_multi_layer).toBe(false);

      const multiLayer = createTestLayout({
        layers: [makeLayer('layer1', 'Layer 1', 3), makeLayer('layer2', 'Layer 2', 6)],
      });
      expect(computeLayoutMetrics(multiLayer).feature_multi_layer).toBe(true);
    });

    it('detects half-bin usage', () => {
      const wholeBins = createTestLayout({
        bins: [makeBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2, height: 3 })],
      });
      expect(computeLayoutMetrics(wholeBins).feature_half_bins).toBe(false);

      const halfBins = createTestLayout({
        bins: [makeBin({ id: 'bin1', x: 0.5, y: 0, width: 2, depth: 2, height: 3 })],
      });
      expect(computeLayoutMetrics(halfBins).feature_half_bins).toBe(true);
    });

    it('detects custom print bed size', () => {
      const defaultBed = createTestLayout({ printBedSize: mm(256) });
      expect(computeLayoutMetrics(defaultBed).feature_custom_print_bed).toBe(false);

      const customBed = createTestLayout({ printBedSize: mm(300) });
      expect(computeLayoutMetrics(customBed).feature_custom_print_bed).toBe(true);
    });
  });

  describe('print readiness', () => {
    it('detects oversized bins', () => {
      // With 256mm print bed and 42mm grid units, max is ~6 units
      const layout = createTestLayout({
        printBedSize: mm(256),
        gridUnitMm: mm(42),
        bins: [makeBin({ id: 'bin1', x: 0, y: 0, width: 7, depth: 2, height: 3 })],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.has_oversized_bins).toBe(true);
      expect(metrics.max_bin_width).toBe(7);
    });

    it('tracks max bin dimensions', () => {
      const layout = createTestLayout({
        bins: [
          makeBin({ id: 'bin1', x: 0, y: 0, width: 3, depth: 4, height: 3 }),
          makeBin({ id: 'bin2', x: 3, y: 0, width: 5, depth: 2, height: 3 }),
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.max_bin_width).toBe(5);
      expect(metrics.max_bin_depth).toBe(4);
    });
  });

  describe('engagement metrics', () => {
    it('marks as engaged at 5+ bins', () => {
      const fewBins = createTestLayout({
        bins: Array(4)
          .fill(null)
          .map((_, i) => makeBin({ id: `bin${i}`, x: i, y: 0, width: 1, depth: 1, height: 3 })),
      });
      expect(computeLayoutMetrics(fewBins).is_engaged).toBe(false);

      const engagedBins = createTestLayout({
        bins: Array(5)
          .fill(null)
          .map((_, i) => makeBin({ id: `bin${i}`, x: i, y: 0, width: 1, depth: 1, height: 3 })),
      });
      expect(computeLayoutMetrics(engagedBins).is_engaged).toBe(true);
    });

    it('marks as substantial at 15+ bins', () => {
      const moderateBins = createTestLayout({
        bins: Array(14)
          .fill(null)
          .map((_, i) =>
            makeBin({
              id: `bin${i}`,
              x: i % 10,
              y: Math.floor(i / 10),
              width: 1,
              depth: 1,
              height: 3,
            })
          ),
      });
      expect(computeLayoutMetrics(moderateBins).is_substantial).toBe(false);

      const substantialBins = createTestLayout({
        bins: Array(15)
          .fill(null)
          .map((_, i) =>
            makeBin({
              id: `bin${i}`,
              x: i % 10,
              y: Math.floor(i / 10),
              width: 1,
              depth: 1,
              height: 3,
            })
          ),
      });
      expect(computeLayoutMetrics(substantialBins).is_substantial).toBe(true);
    });
  });
});

describe('getDeviceType', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('returns mobile for small screens', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    expect(getDeviceType()).toBe('mobile');
  });

  it('returns tablet for medium screens', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    expect(getDeviceType()).toBe('tablet');
  });

  it('returns desktop for large screens', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    expect(getDeviceType()).toBe('desktop');
  });
});

describe('tracking functions', () => {
  // These functions use the internal capture() which queues events
  // Since posthog isn't initialized in tests, we verify they don't throw

  describe('trackLayoutSnapshot', () => {
    it('does not throw for valid layout', () => {
      const layout = createTestLayout();
      expect(() => trackLayoutSnapshot(layout, 'export_json')).not.toThrow();
    });

    it('does not throw with session context', () => {
      const layout = createTestLayout();
      expect(() =>
        trackLayoutSnapshot(layout, 'session_engaged', { duration_seconds: 300 })
      ).not.toThrow();
    });

    it('skips non-engaged users on session_engaged trigger', () => {
      // Empty layout = not engaged, should skip silently
      const layout = createTestLayout({ bins: [] });
      expect(() => trackLayoutSnapshot(layout, 'session_engaged')).not.toThrow();
    });
  });

  describe('trackEvent', () => {
    it('does not throw', () => {
      expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
    });

    it('handles undefined properties', () => {
      expect(() => trackEvent('test_event')).not.toThrow();
    });
  });

  describe('track3DPreview', () => {
    it('does not throw', () => {
      expect(() => track3DPreview('opened')).not.toThrow();
      expect(() => track3DPreview('expanded')).not.toThrow();
      expect(() => track3DPreview('camera_preset', 'top')).not.toThrow();
    });
  });

  describe('trackLayoutAction', () => {
    it('does not throw for all action types', () => {
      expect(() => trackLayoutAction('created')).not.toThrow();
      expect(() => trackLayoutAction('switched')).not.toThrow();
      expect(() => trackLayoutAction('deleted')).not.toThrow();
      expect(() => trackLayoutAction('duplicated')).not.toThrow();
      expect(() => trackLayoutAction('imported')).not.toThrow();
      expect(() => trackLayoutAction('renamed')).not.toThrow();
    });

    it('accepts source parameter', () => {
      expect(() => trackLayoutAction('created', 'layout_manager')).not.toThrow();
    });
  });

  describe('trackFillOperation', () => {
    it('does not throw', () => {
      expect(() => trackFillOperation('fill_layer', 25)).not.toThrow();
      expect(() => trackFillOperation('fill_gaps', 10)).not.toThrow();
    });
  });

  describe('trackPaintMode', () => {
    it('does not throw', () => {
      expect(() => trackPaintMode('entered')).not.toThrow();
      expect(() => trackPaintMode('exited', 5)).not.toThrow();
    });
  });
});

describe('initAnalytics', () => {
  it('does not throw when called in dev mode', () => {
    // In dev mode, initAnalytics returns early at line 25 and does nothing
    // This test verifies the function handles dev mode gracefully
    expect(() => initAnalytics()).not.toThrow();
  });

  it('is idempotent (multiple calls are safe)', () => {
    // First call (returns early in dev mode)
    initAnalytics();
    // Subsequent calls should also return early without error
    expect(() => initAnalytics()).not.toThrow();
    expect(() => initAnalytics()).not.toThrow();
  });
});

describe('computeLabsMetrics', () => {
  beforeEach(() => {
    // Reset labs store to default state
    setEnabledFeatures({});
  });

  it('returns empty features when none enabled', () => {
    const metrics = computeLabsMetrics();
    expect(metrics.labs_enabled_features).toEqual([]);
    expect(metrics.labs_enabled_count).toBe(0);
  });

  it('includes experimental features that are enabled', () => {
    setEnabledFeatures({ show_generation_perf: true });

    const metrics = computeLabsMetrics();
    expect(metrics.labs_enabled_features).toContain('show_generation_perf');
    expect(metrics.labs_enabled_count).toBe(1);
  });

  it('excludes disabled features', () => {
    setEnabledFeatures({ show_generation_perf: false });

    const metrics = computeLabsMetrics();
    expect(metrics.labs_enabled_features).not.toContain('show_generation_perf');
    expect(metrics.labs_enabled_count).toBe(0);
  });

  it('excludes graduated features even when the old preference is still set', () => {
    setEnabledFeatures({ collaborative_editing: true });

    const metrics = computeLabsMetrics();
    expect(metrics.labs_enabled_features).not.toContain('collaborative_editing');
    expect(metrics.labs_enabled_count).toBe(0);
  });

  it('excludes unknown feature IDs', () => {
    setEnabledFeatures({ unknown_feature: true });

    const metrics = computeLabsMetrics();
    // Unknown features should be excluded since getFeature returns null
    expect(metrics.labs_enabled_features).not.toContain('unknown_feature');
  });
});

describe('listenForPwaInstall', () => {
  it('does not throw when called', () => {
    expect(() => listenForPwaInstall()).not.toThrow();
  });

  it('registers appinstalled event listener with once option', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    listenForPwaInstall();
    expect(addEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function), {
      once: true,
    });
    addEventListenerSpy.mockRestore();
  });
});

describe('captureUtmParameters', () => {
  const originalLocation = window.location.href;

  afterEach(() => {
    window.history.replaceState({}, '', originalLocation);
  });

  it('does not throw when no UTM params present', () => {
    expect(() => captureUtmParameters()).not.toThrow();
  });

  it('does not strip UTM params when PostHog is unavailable', () => {
    window.history.replaceState({}, '', '/?utm_source=reddit&utm_medium=post&utm_campaign=launch');

    captureUtmParameters();

    // UTMs should remain — stripping only happens after successful PostHog capture
    const url = new URL(window.location.href);
    expect(url.searchParams.has('utm_source')).toBe(true);
    expect(url.searchParams.has('utm_medium')).toBe(true);
    expect(url.searchParams.has('utm_campaign')).toBe(true);
  });
});
