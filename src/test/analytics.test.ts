import { describe, it, expect, afterEach } from 'vitest';
import type { Layout } from '../types';
import {
  computeLayoutMetrics,
  getDeviceType,
  getActivityContext,
  trackLayoutSnapshot,
  trackEvent,
  track3DPreview,
  trackLayoutAction,
  trackFillOperation,
  trackPaintMode,
} from '../utils/analytics';
import { useInteractionStore } from '../store/interaction';
import { STAGING_ID } from '../constants';

// Helper to create a test layout
const createTestLayout = (overrides?: Partial<Layout>): Layout => ({
  version: '1.0',
  name: 'Test Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [
    { id: 'coral', name: 'Coral', color: '#FF6B6B' },
    { id: 'custom1', name: 'My Custom Category', color: '#00FF00' },
  ],
  layers: [
    { id: 'layer1', name: 'Layer 1', height: 3 },
  ],
  bins: [],
  ...overrides,
});

describe('computeLayoutMetrics', () => {
  describe('drawer configuration', () => {
    it('captures drawer dimensions', () => {
      const layout = createTestLayout({
        drawer: { width: 15, depth: 12, height: 18 },
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.drawer_width).toBe(15);
      expect(metrics.drawer_depth).toBe(12);
      expect(metrics.drawer_height).toBe(18);
    });

    it('captures grid settings', () => {
      const layout = createTestLayout({
        gridUnitMm: 50,
        heightUnitMm: 10,
        printBedSize: 300,
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.grid_unit_mm).toBe(50);
      expect(metrics.height_unit_mm).toBe(10);
      expect(metrics.print_bed_size).toBe(300);
    });

    it('detects default drawer', () => {
      const defaultLayout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      expect(computeLayoutMetrics(defaultLayout).drawer_is_default).toBe(true);

      const customLayout = createTestLayout({
        drawer: { width: 15, depth: 10, height: 12 },
      });
      expect(computeLayoutMetrics(customLayout).drawer_is_default).toBe(false);
    });
  });

  describe('bin statistics', () => {
    it('counts total bins', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin3', layerId: STAGING_ID, x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'coral', label: '', notes: '' },
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
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: 'Screws', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin3', layerId: 'layer1', x: 4, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '  ', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_labels).toBe(1);
    });

    it('counts bins with notes', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: 'M3 screws' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_notes).toBe(1);
    });

    it('counts bins with clearance height', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '', clearanceHeight: 2 },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '', clearanceHeight: 0 },
          { id: 'bin3', layerId: 'layer1', x: 4, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_clearance).toBe(1);
    });

    it('counts bins with half-unit dimensions', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0.5, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 1.5, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin3', layerId: 'layer1', x: 4, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_half_units).toBe(2);
    });

    it('calculates average bin area', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' }, // 4
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 3, depth: 2, height: 3, category: 'coral', label: '', notes: '' }, // 6
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
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin3', layerId: 'layer1', x: 4, y: 0, width: 1, depth: 1, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_top_sizes[0]).toEqual({ size: '2x2', count: 2 });
      expect(metrics.bin_top_sizes[1]).toEqual({ size: '1x1', count: 1 });
    });

    it('tracks bin height distribution', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin3', layerId: 'layer1', x: 4, y: 0, width: 2, depth: 2, height: 6, category: 'coral', label: '', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_heights).toEqual({ 3: 2, 6: 1 });
    });
  });

  describe('layer statistics', () => {
    it('counts layers', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 6 },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.layer_count).toBe(2);
    });

    it('captures layer heights', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 6 },
        ],
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
          { id: 'coral', name: 'Coral', color: '#FF6B6B' }, // default
          { id: 'sky', name: 'Sky', color: '#38bdf8' }, // default
          { id: 'custom1', name: 'My Screws', color: '#00FF00' }, // custom
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.custom_category_count).toBe(1);
    });

    it('tracks top categories by bin count', () => {
      const layout = createTestLayout({
        categories: [
          { id: 'coral', name: 'Coral', color: '#FF6B6B' },
          { id: 'sky', name: 'Sky', color: '#38bdf8' },
        ],
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin3', layerId: 'layer1', x: 4, y: 0, width: 2, depth: 2, height: 3, category: 'sky', label: '', notes: '' },
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
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      });
      expect(computeLayoutMetrics(singleLayer).feature_multi_layer).toBe(false);

      const multiLayer = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 6 },
        ],
      });
      expect(computeLayoutMetrics(multiLayer).feature_multi_layer).toBe(true);
    });

    it('detects half-bin usage', () => {
      const wholeBins = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      expect(computeLayoutMetrics(wholeBins).feature_half_bins).toBe(false);

      const halfBins = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0.5, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      expect(computeLayoutMetrics(halfBins).feature_half_bins).toBe(true);
    });

    it('detects custom print bed size', () => {
      const defaultBed = createTestLayout({ printBedSize: 256 });
      expect(computeLayoutMetrics(defaultBed).feature_custom_print_bed).toBe(false);

      const customBed = createTestLayout({ printBedSize: 300 });
      expect(computeLayoutMetrics(customBed).feature_custom_print_bed).toBe(true);
    });
  });

  describe('print readiness', () => {
    it('detects oversized bins', () => {
      // With 256mm print bed and 42mm grid units, max is ~6 units
      const layout = createTestLayout({
        printBedSize: 256,
        gridUnitMm: 42,
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 7, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
        ],
      });
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.has_oversized_bins).toBe(true);
      expect(metrics.max_bin_width).toBe(7);
    });

    it('tracks max bin dimensions', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 4, height: 3, category: 'coral', label: '', notes: '' },
          { id: 'bin2', layerId: 'layer1', x: 3, y: 0, width: 5, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
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
        bins: Array(4).fill(null).map((_, i) => ({
          id: `bin${i}`, layerId: 'layer1', x: i, y: 0, width: 1, depth: 1, height: 3, category: 'coral', label: '', notes: '',
        })),
      });
      expect(computeLayoutMetrics(fewBins).is_engaged).toBe(false);

      const engagedBins = createTestLayout({
        bins: Array(5).fill(null).map((_, i) => ({
          id: `bin${i}`, layerId: 'layer1', x: i, y: 0, width: 1, depth: 1, height: 3, category: 'coral', label: '', notes: '',
        })),
      });
      expect(computeLayoutMetrics(engagedBins).is_engaged).toBe(true);
    });

    it('marks as substantial at 15+ bins', () => {
      const moderateBins = createTestLayout({
        bins: Array(14).fill(null).map((_, i) => ({
          id: `bin${i}`, layerId: 'layer1', x: i % 10, y: Math.floor(i / 10), width: 1, depth: 1, height: 3, category: 'coral', label: '', notes: '',
        })),
      });
      expect(computeLayoutMetrics(moderateBins).is_substantial).toBe(false);

      const substantialBins = createTestLayout({
        bins: Array(15).fill(null).map((_, i) => ({
          id: `bin${i}`, layerId: 'layer1', x: i % 10, y: Math.floor(i / 10), width: 1, depth: 1, height: 3, category: 'coral', label: '', notes: '',
        })),
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
      expect(() => trackLayoutSnapshot(layout, 'session_engaged', { duration_seconds: 300 })).not.toThrow();
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

describe('getActivityContext', () => {
  afterEach(() => {
    // Reset interaction store to initial state
    useInteractionStore.setState({
      interaction: null,
      paintSize: null,
      keyboardDragMode: false,
      keyboardResizeMode: false,
    });
  });

  it('returns viewing when no interaction is active', () => {
    expect(getActivityContext()).toBe('viewing');
  });

  it('returns drawing when in draw mode', () => {
    useInteractionStore.setState({
      interaction: { type: 'draw', start: { x: 0, y: 0 }, current: { x: 1, y: 1 } },
    });
    expect(getActivityContext()).toBe('drawing');
  });

  it('returns drawing when in paint mode', () => {
    useInteractionStore.setState({
      interaction: { type: 'paint', start: { x: 0, y: 0 }, current: { x: 2, y: 2 }, paintSize: { width: 1, depth: 1 } },
    });
    expect(getActivityContext()).toBe('drawing');
  });

  it('returns drawing when paintSize is set (paint mode active)', () => {
    useInteractionStore.setState({
      paintSize: { width: 2, depth: 2 },
    });
    expect(getActivityContext()).toBe('drawing');
  });

  it('returns editing when in drag mode', () => {
    useInteractionStore.setState({
      interaction: { type: 'drag', binIds: ['bin1'], startCoord: { x: 0, y: 0 }, currentCoord: { x: 1, y: 1 }, valid: true, isOverGrid: true },
    });
    expect(getActivityContext()).toBe('editing');
  });

  it('returns editing when in resize mode', () => {
    useInteractionStore.setState({
      interaction: { type: 'resize', binIds: ['bin1'], handle: 'e', startRects: new Map(), currentRects: new Map(), valid: true },
    });
    expect(getActivityContext()).toBe('editing');
  });

  it('returns editing when in stagingDrag mode', () => {
    useInteractionStore.setState({
      interaction: { type: 'stagingDrag', binId: 'bin1', currentCoord: { x: 1, y: 1 }, valid: true },
    });
    expect(getActivityContext()).toBe('editing');
  });

  it('returns editing when keyboard drag mode is active', () => {
    useInteractionStore.setState({
      keyboardDragMode: true,
    });
    expect(getActivityContext()).toBe('editing');
  });

  it('returns editing when keyboard resize mode is active', () => {
    useInteractionStore.setState({
      keyboardResizeMode: true,
    });
    expect(getActivityContext()).toBe('editing');
  });
});
