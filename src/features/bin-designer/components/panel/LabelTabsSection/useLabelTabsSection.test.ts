import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabelTabsSection } from './useLabelTabsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useLabelTabsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('toggleLabelTabs enables labels', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    // Default: disabled
    expect(result.current.state.label.enabled).toBe(false);

    act(() => {
      result.current.handlers.toggleLabelTabs();
    });

    expect(useDesignerStore.getState().params.label.enabled).toBe(true);
  });

  it('disabledReason set when style is slotted', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' },
    });

    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.meta.disabledReason).toBeDefined();
    expect(result.current.state.isUnavailable).toBe(true);
  });

  it('no disabledReason when style is standard', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.meta.disabledReason).toBeUndefined();
  });

  it('summary is undefined when labels disabled', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.meta.summary).toBeUndefined();
  });

  it('summary shows support and width when labels enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      },
    });

    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.meta.summary).toContain('Bracket');
    expect(result.current.meta.summary).toContain('100%');
  });

  it('setTabWidth updates label width', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    act(() => {
      result.current.handlers.setTabWidth(50);
    });

    expect(useDesignerStore.getState().params.label.width).toBe(50);
  });

  it('setTabAlignment updates label alignment', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    act(() => {
      result.current.handlers.setTabAlignment('center');
    });

    expect(useDesignerStore.getState().params.label.alignment).toBe('center');
  });

  it('disabledReason set when height is at minimum (2u)', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, height: 2 },
    });

    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.state.isUnavailable).toBe(true);
    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('no disabledReason when height is above minimum', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, height: 3 },
    });

    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.state.isUnavailable).toBe(false);
    expect(result.current.meta.disabledReason).toBeUndefined();
  });

  it('computes tab width in mm', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    // Default: width=2, gridUnit=42, tolerance=0.5, wallThickness=1.2, 1 col, 100% width
    // outerW = 2*42 - 0.5 = 83.5, innerW = 83.5 - 2*1.2 = 81.1, cellW = 81.1
    expect(result.current.state.tabWidthMm).toBeGreaterThan(0);
  });

  describe('tab height', () => {
    it('heightIsExplicit is false by default and tabHeightMm falls back to wallHeight', () => {
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.heightIsExplicit).toBe(false);
      // Default bin: 3u tall × 7mm = 21mm minus 5mm socket = 16mm wallHeight.
      expect(result.current.state.tabHeightMm).toBe(16);
    });

    it('setTabHeight writes the explicit value', () => {
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.setTabHeight(15);
      });

      expect(useDesignerStore.getState().params.label.height).toBe(15);
    });

    it('tabHeightMin equals depth + 1 (gusset floor clearance)', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 12 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabHeightMin).toBe(13);
    });

    it('tabHeightMax never exceeds wallHeight even when depth + 1 would', () => {
      // 3u tall bin → wallHeight = 16mm. depth = 20mm pushes the depth-derived
      // floor (21) past the ceiling; max must stay at wallHeight and min must
      // collapse to it so the stepper can't request a Z the builder rejects.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 20 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabHeightMax).toBe(16);
      expect(result.current.state.tabHeightMin).toBe(16);
    });

    it('setTabDepth clamps explicit height up when depth invalidates it', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 10, height: 12 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      // New depth 15 invalidates height 12 (gusset would have zero clearance).
      act(() => {
        result.current.handlers.setTabDepth(15);
      });

      expect(useDesignerStore.getState().params.label.depth).toBe(15);
      expect(useDesignerStore.getState().params.label.height).toBe(16);
    });

    it('setTabDepth caps height clamp at wallHeightMm (no out-of-range writes)', () => {
      // 3u tall bin → wallHeight = 16mm. Start with depth=10, height=11.
      // Setting depth to 16 (= wallHeight) would naively clamp height to 17,
      // which would exceed wallHeightMm and silently make the builder drop
      // the tab once depth is reduced again. The cap keeps height ≤ 16.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 10, height: 11 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.setTabDepth(16);
      });

      expect(useDesignerStore.getState().params.label.depth).toBe(16);
      expect(useDesignerStore.getState().params.label.height).toBe(16);
    });

    it('setTabDepth leaves height untouched when height is unset (default-at-top)', () => {
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.setTabDepth(18);
      });

      expect(useDesignerStore.getState().params.label.depth).toBe(18);
      // Optional field stays undefined — no migration of legacy designs.
      expect(useDesignerStore.getState().params.label.height).toBeUndefined();
    });
  });
});
