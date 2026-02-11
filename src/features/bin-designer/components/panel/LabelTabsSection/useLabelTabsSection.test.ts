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

  it('computes tab width in mm', () => {
    const { result } = renderHook(() => useLabelTabsSection());

    // Default: width=2, gridUnit=42, tolerance=0.5, wallThickness=1.2, 1 col, 100% width
    // outerW = 2*42 - 0.5 = 83.5, innerW = 83.5 - 2*1.2 = 81.1, cellW = 81.1
    expect(result.current.state.tabWidthMm).toBeGreaterThan(0);
  });
});
