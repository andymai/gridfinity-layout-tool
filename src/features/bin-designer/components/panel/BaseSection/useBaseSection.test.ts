import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBaseSection } from './useBaseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useBaseSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('derives hasMagnet and hasScrew from base style', () => {
    const { result } = renderHook(() => useBaseSection());

    // Default: standard style
    expect(result.current.state.hasMagnet).toBe(false);
    expect(result.current.state.hasScrew).toBe(false);
  });

  it('toggleMagnet sets style to magnet', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleMagnet();
    });

    expect(useDesignerStore.getState().params.base.style).toBe('magnet');
  });

  it('toggleScrew sets style to screw', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleScrew();
    });

    expect(useDesignerStore.getState().params.base.style).toBe('screw');
  });

  it('toggling both sets magnet_and_screw', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleMagnet();
    });
    act(() => {
      result.current.handlers.toggleScrew();
    });

    expect(useDesignerStore.getState().params.base.style).toBe('magnet_and_screw');
  });

  it('toggleStackingLip flips the boolean', () => {
    const { result } = renderHook(() => useBaseSection());

    // Default: stackingLip = true
    expect(useDesignerStore.getState().params.base.stackingLip).toBe(true);

    act(() => {
      result.current.handlers.toggleStackingLip();
    });

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(false);
  });

  it('setMagnetRadius updates magnetDiameter (radius × 2)', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setMagnetRadius(4.0);
    });

    expect(useDesignerStore.getState().params.base.magnetDiameter).toBe(8.0);
  });

  it('setScrewRadius updates screwDiameter (radius × 2)', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setScrewRadius(2.0);
    });

    expect(useDesignerStore.getState().params.base.screwDiameter).toBe(4.0);
  });

  it('summary shows active features', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
      },
    });

    const { result } = renderHook(() => useBaseSection());

    expect(result.current.meta.summary).toContain('magnets');
    expect(result.current.meta.summary).toContain('Lip');
  });

  it('summary shows standard when no features', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
      },
    });

    const { result } = renderHook(() => useBaseSection());

    expect(result.current.meta.summary).toBe('Standard (no attachment)');
  });

  describe('flat floor', () => {
    it('derives isFlat from base style', () => {
      const { result } = renderHook(() => useBaseSection());

      // Default: standard style, not flat
      expect(result.current.state.isFlat).toBe(false);
    });

    it('toggleFlat sets style to flat', () => {
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleFlat();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
      expect(result.current.state.isFlat).toBe(true);
    });

    it('toggleFlat off reverts to standard', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleFlat();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('standard');
      expect(result.current.state.isFlat).toBe(false);
    });

    it('flat disables magnet and screw', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      expect(result.current.state.hasMagnet).toBe(false);
      expect(result.current.state.hasScrew).toBe(false);
      expect(result.current.handlers.flatDisabledReason).toBeDefined();
    });

    it('toggleMagnet is a no-op when flat', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleMagnet();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
    });

    it('toggleScrew is a no-op when flat', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleScrew();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
    });

    it('flatDisabledReason is undefined when not flat', () => {
      const { result } = renderHook(() => useBaseSection());

      expect(result.current.handlers.flatDisabledReason).toBeUndefined();
    });

    it('summary shows flat floor when enabled', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      expect(result.current.meta.summary).toContain('Flat floor');
      expect(result.current.meta.summary).toContain('Lip');
      expect(result.current.meta.summary).not.toContain('magnets');
    });
  });
});
