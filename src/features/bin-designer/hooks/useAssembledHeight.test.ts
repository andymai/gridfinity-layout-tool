import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssembledHeight } from './useAssembledHeight';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import type { StoredBaseplateParams } from '@/core/types';
import { mm } from '@/core/types';

function setPlate(plate: StoredBaseplateParams | undefined): void {
  useLayoutStore.setState((s) => ({ layout: { ...s.layout, baseplateParams: plate } }));
}

function setDrawerHeight(heightMm: number | undefined): void {
  useLayoutStore.setState((s) => ({
    layout: {
      ...s.layout,
      drawer: {
        ...s.layout.drawer,
        measuredMm:
          heightMm === undefined ? undefined : { width: 400, depth: 500, height: heightMm },
      },
    },
  }));
}

describe('useAssembledHeight', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      // 6u body (42mm) with a 4.3mm lip = 46.3mm assembled on a plain plate.
      params: {
        ...DEFAULT_BIN_PARAMS,
        height: 6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
    setPlate(DEFAULT_BASEPLATE_PARAMS);
    setDrawerHeight(undefined);
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, showAssembledHeightBreakdown: false },
    }));
  });

  it('derives the total from the design and the layout plate', () => {
    const { result } = renderHook(() => useAssembledHeight());
    expect(result.current.breakdown.totalMm).toBeCloseTo(46.3, 6);
  });

  it('reads the layout baseplate rather than assuming a plain one', () => {
    setPlate({ ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true, magnetDepth: mm(2) });
    const { result } = renderHook(() => useAssembledHeight());
    expect(result.current.breakdown.totalMm).toBeCloseTo(48.8, 6);
  });

  it('falls back to a standard plate when the layout has none', () => {
    setPlate(undefined);
    const { result } = renderHook(() => useAssembledHeight());
    expect(result.current.breakdown.baseplatePrintedMm).toBe(5);
    expect(result.current.breakdown.totalMm).toBeCloseTo(46.3, 6);
  });

  describe('expansion', () => {
    it('persists the toggle to settings', () => {
      const { result } = renderHook(() => useAssembledHeight());
      expect(result.current.expanded).toBe(false);

      act(() => {
        result.current.toggleExpanded();
      });

      expect(useSettingsStore.getState().settings.showAssembledHeightBreakdown).toBe(true);
      expect(result.current.expanded).toBe(true);
    });
  });

  describe('clearance', () => {
    it('is null without a measured drawer height', () => {
      const { result } = renderHook(() => useAssembledHeight());
      expect(result.current.clearance).toBeNull();
    });

    it('does NOT fall back to the layout drawer height in units', () => {
      // `layout.drawer.height` always exists; comparing against it would floor
      // the measurement and report a false overflow.
      useLayoutStore.setState((s) => ({
        layout: { ...s.layout, drawer: { ...s.layout.drawer, measuredMm: undefined } },
      }));
      const { result } = renderHook(() => useAssembledHeight());
      expect(result.current.clearance).toBeNull();
    });

    it('reports positive slack when the design fits', () => {
      setDrawerHeight(60);
      const { result } = renderHook(() => useAssembledHeight());
      expect(result.current.clearance?.fits).toBe(true);
      expect(result.current.clearance?.slackMm).toBeCloseTo(13.7, 6);
    });

    it('reports negative slack when it does not fit', () => {
      setDrawerHeight(40);
      const { result } = renderHook(() => useAssembledHeight());
      expect(result.current.clearance?.fits).toBe(false);
      expect(result.current.clearance?.slackMm).toBeCloseTo(-6.3, 6);
    });

    it('counts an exact match as fitting', () => {
      setDrawerHeight(46.3);
      const { result } = renderHook(() => useAssembledHeight());
      expect(result.current.clearance?.fits).toBe(true);
    });
  });
});
