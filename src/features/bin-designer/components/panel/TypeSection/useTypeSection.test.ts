import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypeSection } from './useTypeSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_TEXT_STYLE_DEFAULTS, TEXT_PRESETS } from '@/features/bin-designer/types';

const setStyle = (partial: Partial<typeof DEFAULT_TEXT_STYLE_DEFAULTS>) =>
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, textDefaults: { ...DEFAULT_TEXT_STYLE_DEFAULTS, ...partial } },
  });

describe('useTypeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS }, ui: { ...DEFAULT_UI_STATE } });
  });

  it('derives the active preset from the fields rather than a stored id', () => {
    setStyle(TEXT_PRESETS.engineering);
    expect(renderHook(() => useTypeSection()).result.current.state.activePreset).toBe(
      'engineering'
    );
  });

  it('reports a custom style once any preset field is changed', () => {
    setStyle({ ...TEXT_PRESETS.engineering, anchor: 'top-right' });
    expect(renderHook(() => useTypeSection()).result.current.state.activePreset).toBeNull();
  });

  it('applies a preset as a whole style, stranding nothing from the previous one', () => {
    setStyle({ ...TEXT_PRESETS.engineering, tracking: 0.3 });
    const { result } = renderHook(() => useTypeSection());
    act(() => result.current.handlers.applyPreset('classic'));
    expect(useDesignerStore.getState().params.textDefaults).toEqual(TEXT_PRESETS.classic);
  });

  it('steps land on the control grid, not on an offset carried from a preset', () => {
    setStyle({ margin: 3.2 });
    const { result } = renderHook(() => useTypeSection());
    act(() => result.current.handlers.step('margin', 1));
    // 3.2 + 0.5 = 3.7, snapped to the 0.5 grid.
    expect(useDesignerStore.getState().params.textDefaults.margin).toBe(3.5);
  });

  it('clamps a step at the bound instead of running past it', () => {
    setStyle({ depth: 3 });
    const { result } = renderHook(() => useTypeSection());
    act(() => result.current.handlers.step('depth', 1));
    expect(useDesignerStore.getState().params.textDefaults.depth).toBe(3);
  });
});

describe('useTypeSection stem fix', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS }, ui: { ...DEFAULT_UI_STATE } });
  });

  it('reaches for the heavier cut first, since it moves no caption', () => {
    setStyle({ font: 'atkinson', autoTracking: false });
    const { result } = renderHook(() => useTypeSection());
    act(() => result.current.handlers.fixStem());
    const after = useDesignerStore.getState().params.textDefaults;
    expect(after.font).toBe('atkinson-bold');
    expect(after.autoTracking).toBe(false);
  });

  it('opens tracking when the family has no heavier cut', () => {
    setStyle({ font: 'barlow-condensed', autoTracking: false });
    const { result } = renderHook(() => useTypeSection());
    act(() => result.current.handlers.fixStem());
    expect(useDesignerStore.getState().params.textDefaults.autoTracking).toBe(true);
  });

  it('grows the type only once the cheaper moves are exhausted', () => {
    setStyle({ font: 'barlow-condensed', autoTracking: true, sizeMode: 'auto', fixedSize: 4 });
    const { result } = renderHook(() => useTypeSection());
    act(() => result.current.handlers.fixStem());
    const after = useDesignerStore.getState().params.textDefaults;
    expect(after.sizeMode).toBe('fixed');
    expect(after.fixedSize).toBeGreaterThan(4);
    // The floor moves with it, or auto-fit could still drop back below it.
    expect(after.minFontSize).toBe(after.fixedSize);
  });

  it('surfaces the worker measurement rather than recomputing it', () => {
    useDesignerStore.setState({
      generation: {
        ...useDesignerStore.getState().generation,
        mesh: { typeStemWarning: { minStemMm: 0.4, fontSizeMm: 3, minPrintableStemMm: 0.8 } },
      },
    } as never);
    const { result } = renderHook(() => useTypeSection());
    expect(result.current.state.stemWarning?.minStemMm).toBe(0.4);
  });
});

describe('useTypeSection specimen', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS }, ui: { ...DEFAULT_UI_STATE } });
  });

  it("previews the design's own caption rather than a canned sample", () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'M4 CAP SCREWS' } } },
    });
    expect(renderHook(() => useTypeSection()).result.current.state.specimenText).toBe(
      'M4 CAP SCREWS'
    );
  });

  it('falls back to a sample only while the design has nothing to say', () => {
    const { specimenText } = renderHook(() => useTypeSection()).result.current.state;
    expect(specimenText).toContain('\n');
  });

  it('reaches past surface text to a compartment caption', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          compartmentTexts: ['', 'WASHERS'],
        },
      },
    });
    expect(renderHook(() => useTypeSection()).result.current.state.specimenText).toBe('WASHERS');
  });
});

describe('useTypeSection stem fix naming', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS }, ui: { ...DEFAULT_UI_STATE } });
  });

  it('names the move it will make, so the button is not a blind "fix it"', () => {
    setStyle({ font: 'atkinson', autoTracking: false });
    expect(renderHook(() => useTypeSection()).result.current.state.stemFixAction).toBe('bold');

    setStyle({ font: 'barlow-condensed', autoTracking: false });
    expect(renderHook(() => useTypeSection()).result.current.state.stemFixAction).toBe('tracking');

    setStyle({ font: 'barlow-condensed', autoTracking: true });
    expect(renderHook(() => useTypeSection()).result.current.state.stemFixAction).toBe('size');
  });
});
