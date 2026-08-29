import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallsSection } from './useWallsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useWallsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns current wall thickness', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.wallThickness).toBe(1.2);
  });

  it('handleChange updates wall thickness in store', () => {
    const { result } = renderHook(() => useWallsSection());

    act(() => {
      result.current.handlers.handleChange(1.6);
    });

    expect(useDesignerStore.getState().params.wallThickness).toBe(1.6);
  });

  it('options contain translated descriptions', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.options.length).toBeGreaterThan(0);
    expect(result.current.state.options[0]).toHaveProperty('value');
    expect(result.current.state.options[0]).toHaveProperty('description');
  });

  it('initial state has pattern disabled', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.patternEnabled).toBe(false);
  });

  it('handlePatternChange enables honeycomb pattern', () => {
    const { result } = renderHook(() => useWallsSection());

    act(() => {
      result.current.handlers.handlePatternChange('honeycomb');
    });

    expect(useDesignerStore.getState().params.wallPattern.enabled).toBe(true);
    expect(useDesignerStore.getState().params.wallPattern.pattern).toBe('honeycomb');
  });

  it('handlePatternChange with null disables pattern', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      },
    });

    const { result } = renderHook(() => useWallsSection());

    act(() => {
      result.current.handlers.handlePatternChange(null);
    });

    expect(useDesignerStore.getState().params.wallPattern.enabled).toBe(false);
  });

  it('patternDisabledReason set when all walls slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      },
    });

    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.patternDisabledReason).toBe('All walls have divider slots');
  });

  it('patternPartialNote set when some walls slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });

    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.patternPartialNote).toBe(
      'Walls with divider slots will keep solid walls'
    );
  });

  it('returns current pattern type', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      },
    });

    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.pattern).toBe('honeycomb');
    expect(result.current.state.patternEnabled).toBe(true);
  });

  describe('divider walls', () => {
    const PATTERNED_2X2 = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    };

    it('starts off and writes the opt-in to the store', () => {
      useDesignerStore.setState({ params: PATTERNED_2X2 });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersEnabled).toBe(false);

      act(() => {
        result.current.handlers.handleDividersChange(true);
      });

      expect(useDesignerStore.getState().params.wallPattern.dividers).toBe(true);
      expect(useDesignerStore.getState().params.wallPattern.pattern).toBe('honeycomb');
    });

    it('explains why a single-compartment bin has nothing to pattern', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          wallPattern: { enabled: true, pattern: 'honeycomb' as const },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersAvailableReason).toBe(
        'Add compartments to pattern their dividers'
      );
    });

    it('treats a zero-thickness grid as having no dividers', () => {
      useDesignerStore.setState({
        params: {
          ...PATTERNED_2X2,
          compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0 },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersAvailableReason).toBe(
        'Add compartments to pattern their dividers'
      );
    });

    it('gives solid bins their own explanation, not the slotted one', () => {
      useDesignerStore.setState({
        params: {
          ...PATTERNED_2X2,
          style: 'solid',
          base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersAvailableReason).toBe(
        'Solid bins have no compartments to divide'
      );
    });

    it('offers the option on slotted bins and says where the pattern shows up', () => {
      useDesignerStore.setState({
        params: {
          ...PATTERNED_2X2,
          style: 'slotted',
          wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: true },
          slotConfig: {
            ...DEFAULT_BIN_PARAMS.slotConfig,
            x: { enabled: true, pitch: 20 },
            y: { enabled: false, pitch: 20 },
          },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersAvailableReason).toBeUndefined();
      expect(result.current.state.dividersNote).toBe(
        'The pattern appears on the exported divider pieces (the preview shows them solid)'
      );
    });

    it('has nothing to pattern on a slotted bin with no slots', () => {
      useDesignerStore.setState({
        params: {
          ...PATTERNED_2X2,
          style: 'slotted',
          slotConfig: {
            ...DEFAULT_BIN_PARAMS.slotConfig,
            x: { enabled: false, pitch: 20 },
            y: { enabled: false, pitch: 20 },
          },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersAvailableReason).toBe(
        'Enable divider slots to pattern the divider pieces'
      );
    });

    it('notes when the dividers are too small to carry the pattern', () => {
      useDesignerStore.setState({
        params: {
          ...PATTERNED_2X2,
          height: 1,
          wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: true },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersNote).toBe('Dividers are too small for this pattern');
    });

    it('has no note when every divider fits', () => {
      useDesignerStore.setState({
        params: {
          ...PATTERNED_2X2,
          wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: true },
        },
      });
      const { result } = renderHook(() => useWallsSection());
      expect(result.current.state.dividersAvailableReason).toBeUndefined();
      expect(result.current.state.dividersNote).toBeUndefined();
    });
  });
});
