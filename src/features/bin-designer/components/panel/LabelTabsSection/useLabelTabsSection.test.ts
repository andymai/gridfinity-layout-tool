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

  it('disabledReason set when wall height is at the label-tab minimum (default 2u = 9mm)', () => {
    // Default 7mm height unit, socketed: 2u → wallHeight = 2×7 − 5 = 9mm,
    // which equals MIN_LABEL_TAB_HEIGHT, so the tab still cannot fit.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, height: 2 },
    });

    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.state.isUnavailable).toBe(true);
    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('no disabledReason when wall height clears the minimum (default 3u = 16mm)', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, height: 3 },
    });

    const { result } = renderHook(() => useLabelTabsSection());

    expect(result.current.state.isUnavailable).toBe(false);
    expect(result.current.meta.disabledReason).toBeUndefined();
  });

  it('available at a low unit count when heightUnitMm makes the wall tall enough (#2422)', () => {
    // Reporter's case: gating is on physical wall height (mm), not unit count.
    // 2u × 20mm height unit, socketed → wallHeight = 2×20 − 5 = 35mm, well
    // above MIN_LABEL_TAB_HEIGHT (9mm). The old `height <= 2u` gate wrongly
    // disabled this tall-but-few-units bin.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, height: 2, heightUnitMm: 20 },
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

  describe('edges + inset (#1898)', () => {
    it('setTabEdges writes the edge value', () => {
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.setTabEdges('both');
      });

      expect(useDesignerStore.getState().params.label.edges).toBe('both');
    });

    it('setTabInset writes the inset value', () => {
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.setTabInset(5);
      });

      expect(useDesignerStore.getState().params.label.inset).toBe(5);
    });

    it('tabDepthMax clamps against innerD - 1', () => {
      // 1u × 1u × 3u bin: innerD ≈ 38mm. Bridge guard caps depth at 37.
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1 },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      // Static max is 50, but dynamic should be smaller.
      expect(result.current.state.tabDepthMax).toBeLessThan(50);
    });

    it('tabInsetMax for back-only mode = cellD - depth', () => {
      // Default 2u × 2u × 3u bin has rows=1, so cellD = innerD ≈ 81mm.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 12, edges: 'back' },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabInsetMax).toBeGreaterThan(30);
    });

    it('tabInsetMax tightens in both mode = (cellD - 2·depth) / 2', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 12, edges: 'both' },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      // (cellD - 2·12) / 2 ≈ (81 - 24) / 2 ≈ 28.5
      expect(result.current.state.tabInsetMax).toBeGreaterThan(20);
      expect(result.current.state.tabInsetMax).toBeLessThan(40);
    });

    it('tabInsetMax uses cellD (not innerD) so multi-row bins get a conservative ceiling', () => {
      // Greptile review on #1904: with 4 rows on a 2u-deep bin (innerD ≈ 81mm),
      // cellD ≈ 20mm. Back-only mode with depth=8 → cellD - depth = 12mm.
      // The pre-fix formula `innerD - depth` would have offered up to 73mm —
      // most of which the per-compartment collision check rejects.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: {
            ...DEFAULT_BIN_PARAMS.compartments,
            rows: 4,
            cells: [0, 1, 2, 3],
          },
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 8, edges: 'back' },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabInsetMax).toBeLessThan(15);
    });

    it('tabsWillSilentlyDrop fires when both tabs would overlap', () => {
      // 1×1×3u bin, edges='both', depth=18, inset=5 → 2·18 + 2·5 = 46 > innerD≈38.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 1,
          depth: 1,
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'both', depth: 18, inset: 5 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabsWillSilentlyDrop).toBe(true);
    });

    it('tabsWillSilentlyDrop does not fire when there is room for both tabs', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'both', depth: 10, inset: 0 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabsWillSilentlyDrop).toBe(false);
    });

    it('tabsWillSilentlyDrop also fires when single-edge depth+inset overflows compartment', () => {
      // 1×1×3u bin, edges='back', depth=30, inset=15 → 45 > innerD≈38.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 1,
          depth: 1,
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'back', depth: 30, inset: 15 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabsWillSilentlyDrop).toBe(true);
    });

    it('tabsWillSilentlyDrop fires when bridge guard would drop tab', () => {
      // depth >= innerD pushes the tab body through the opposite wall.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 1,
          depth: 1,
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'back', depth: 45, inset: 0 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());
      expect(result.current.state.tabsWillSilentlyDrop).toBe(true);
    });
  });

  describe('auto-fix', () => {
    it('clamps inset to 0 when both-mode collision fires', () => {
      // 2u bin, edges='both', depth=12, inset=30 → triggers collision.
      // Auto-fix priority: inset → depth → ... so dropping inset to 0
      // should be enough (2·12 + 0 = 24 < ~81 innerD).
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'both', depth: 12, inset: 30 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.autoFixDimensions();
      });

      const after = useDesignerStore.getState().params.label;
      expect(after.inset).toBe(0);
      expect(after.edges).toBe('both');
      expect(after.depth).toBe(12);
    });

    it('clamps depth when bridge guard would fire', () => {
      // 1×1×3u bin, depth=45 ≥ innerD≈38 → bridge guard. Auto-fix
      // clamps depth down to fit (innerD - 1 ≈ 37, but limited by
      // tabDepthMax which floors innerD - 1).
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 1,
          depth: 1,
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'back', depth: 45, inset: 0 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.autoFixDimensions();
      });

      const after = useDesignerStore.getState().params.label;
      expect(after.depth).toBeLessThan(45);
      expect(after.edges).toBe('back');
      expect(result.current.state.tabsWillSilentlyDrop).toBe(false);
    });

    it('demotes edges=both → back when even minimum depth cannot fit two tabs', () => {
      // 0.5u bin: innerD ≈ 18mm. MIN_LABEL_TAB_DEPTH = 8mm so 2·8 = 16 fits,
      // but if we shrink further with a smaller cell... actually let's use a
      // multi-row setup where individual cells are too small for two tabs.
      // 1×1 bin with 5 rows: cellD = innerD/5 ≈ 7.6mm. 2·8 = 16 > 7.6 → demote.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 1,
          depth: 1,
          compartments: {
            ...DEFAULT_BIN_PARAMS.compartments,
            rows: 5,
            cells: [0, 1, 2, 3, 4],
          },
          label: { ...DEFAULT_BIN_PARAMS.label, edges: 'both', depth: 12, inset: 0 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.autoFixDimensions();
      });

      const after = useDesignerStore.getState().params.label;
      expect(after.edges).toBe('back');
    });

    it('clamps height back into range when it is too low for the current depth', () => {
      // 5u-tall bin → wallHeight ≈ 30mm, so depth=12 fits comfortably.
      // height=10 is invalid (height ≤ depth) → auto-fix lifts height to
      // depth+1.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          height: 5,
          label: { ...DEFAULT_BIN_PARAMS.label, depth: 12, height: 10 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.autoFixDimensions();
      });

      const after = useDesignerStore.getState().params.label;
      expect(after.height).toBeGreaterThan(after.depth);
    });

    it('clamps depth down to fit the wall height ceiling when too deep', () => {
      // 3u-tall bin: wallHeight ≈ 16mm. depth=20 means tabHeight=depth=20 >
      // wallHeight → the global height guard fires and no geometry can be
      // produced. Auto-fix clamps depth to (height-1) when height is set,
      // or (wallHeight-1) when height is implicit.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, depth: 20, height: 15 },
        },
      });
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.autoFixDimensions();
      });

      const after = useDesignerStore.getState().params.label;
      expect(after.enabled).toBe(true);
      expect(after.depth).toBeLessThan(after.height!);
      expect(after.depth).toBeLessThanOrEqual(14);
    });

    it('does not touch state when geometry already fits', () => {
      // Default config — should be a no-op.
      const before = useDesignerStore.getState().params.label;
      const { result } = renderHook(() => useLabelTabsSection());

      act(() => {
        result.current.handlers.autoFixDimensions();
      });

      const after = useDesignerStore.getState().params.label;
      expect(after.depth).toBe(before.depth);
      expect(after.edges).toBe(before.edges ?? 'back');
      expect(after.inset).toBe(before.inset ?? 0);
    });
  });
});
