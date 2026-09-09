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

describe('useWallsSection strut width', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' },
      },
    });
  });

  it('reads the legacy 0.8 mm when a design carries no strut width', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.patternWebThickness).toBe(0.8);
  });

  it('writes the strut width to the wall pattern', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.handleWebThicknessChange(1.6);
    });
    expect(useDesignerStore.getState().params.wallPattern.webThickness).toBe(1.6);
    expect(result.current.state.patternWebThickness).toBe(1.6);
  });

  it('clamps a strut width into range', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.handleWebThicknessChange(9);
    });
    expect(useDesignerStore.getState().params.wallPattern.webThickness).toBe(2.4);
  });
});

describe('useWallsSection label slots', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2 } });
  });

  it('reads the defaults when a design carries no config', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.labelSlotsEnabled).toBe(false);
    expect(result.current.state.labelSlotSides).toEqual({
      front: true,
      back: false,
      left: false,
      right: false,
    });
    expect(result.current.state.labelSlotEveryCells).toBe(1);
    expect(result.current.state.labelSlotsDisabledReason).toBeUndefined();
  });

  it('toggles the feature through the store', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.toggleLabelSlots();
    });
    expect(useDesignerStore.getState().params.wallLabelSlots?.enabled).toBe(true);
    expect(result.current.state.labelSlotsEnabled).toBe(true);
    act(() => {
      result.current.handlers.toggleLabelSlots();
    });
    expect(useDesignerStore.getState().params.wallLabelSlots).toBeUndefined();
  });

  it('flips one side and keeps the others', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.toggleLabelSlots();
      result.current.handlers.toggleLabelSlotSide('left');
    });
    expect(result.current.state.labelSlotSides).toEqual({
      front: true,
      back: false,
      left: true,
      right: false,
    });
  });

  it('steps the pitch inside its range', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.toggleLabelSlots();
      result.current.handlers.stepLabelSlotEveryCells(1);
    });
    expect(result.current.state.labelSlotEveryCells).toBe(2);
    act(() => {
      result.current.handlers.stepLabelSlotEveryCells(-5);
    });
    expect(result.current.state.labelSlotEveryCells).toBe(1);
    act(() => {
      result.current.handlers.stepLabelSlotEveryCells(50);
    });
    expect(result.current.state.labelSlotEveryCells).toBe(6);
  });

  it('counts the slots the worker will cut', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.toggleLabelSlots();
    });
    expect(result.current.state.labelSlotCount).toBe(3);
    act(() => {
      result.current.handlers.toggleLabelSlotSide('right');
    });
    expect(result.current.state.labelSlotCount).toBe(5);
  });

  it('refuses a custom shape and a bin too short for a plate', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
      },
    });
    const polygon = renderHook(() => useWallsSection());
    expect(polygon.result.current.state.labelSlotsDisabledReason).toBe(
      'Not available for custom-shape bins.'
    );

    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, height: 2 } });
    const short = renderHook(() => useWallsSection());
    expect(short.result.current.state.labelSlotsDisabledReason).toBe(
      'The walls are too short for an 11 mm label plate.'
    );
  });

  it('blocks a wall whose cells are too narrow for a plate', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, gridUnitMm: 30, gridUnitMmY: 42 },
    });
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.labelSlotSideBlocked).toEqual({
      front: true,
      back: true,
      left: false,
      right: false,
    });
  });

  it('explains the boss, the lip notch and a thin wall', () => {
    const { result } = renderHook(() => useWallsSection());
    act(() => {
      result.current.handlers.toggleLabelSlots();
    });
    expect(result.current.state.labelSlotNotes).toEqual([
      'Each slot notches the stacking lip so the plate can drop in from the top.',
      'A 2.4 mm rib on the inside of the wall backs each slot.',
    ]);

    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallThickness: 0.6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        wallLabelSlots: {
          enabled: true,
          sides: { front: true, back: false, left: false, right: false },
          everyCells: 1,
        },
      },
    });
    const thin = renderHook(() => useWallsSection());
    expect(thin.result.current.state.labelSlotNotes).toEqual([
      'A 2.4 mm rib on the inside of the wall backs each slot.',
      'A wall under 0.8 mm leaves a fragile frame in front of the plate.',
    ]);
  });
});
