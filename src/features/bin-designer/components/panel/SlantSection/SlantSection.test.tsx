import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useLabsStore } from '@/core/store';
import { SlantSection } from './SlantSection';
import { useSlantVisible } from './useSlantSection';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, vars?: Record<string, string | number>): string =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
}));

function setParams(over: Partial<typeof DEFAULT_BIN_PARAMS> = {}): void {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 2, height: 6, ...over },
  });
}

const params = () => useDesignerStore.getState().params;
const toggle = () => screen.getByRole('switch', { name: 'binDesigner.slant.title' });

beforeEach(() => setParams());

describe('SlantSection', () => {
  it('turns the slant on at 45 degrees toward the back and drops the stacking lip', () => {
    expect(params().base.stackingLip).toBe(true);
    render(<SlantSection />);
    fireEvent.click(toggle());
    expect(params().slant).toEqual({ angleDeg: 45, side: 'back' });
    expect(params().base.stackingLip).toBe(false);
  });

  it('clears the slant when turned back off', () => {
    setParams({ slant: { angleDeg: 30, side: 'left' } });
    render(<SlantSection />);
    fireEvent.click(toggle());
    expect(params().slant).toBeUndefined();
  });

  it('reads out the top offset and the longest item that fits', () => {
    setParams({ slant: { angleDeg: 45, side: 'back' } });
    render(<SlantSection />);
    // 6u: 42mm top, 4.75mm socket, a 37.25mm rise.
    expect(screen.getByText('binDesigner.slant.topOffset 37')).toBeInTheDocument();
    // Standing on the floor's top: 42 - 4.75 socket - 2.25 floor leaves 35mm,
    // so the diagonal is hypot(81.1 + 35, 35) inside a 2u depth.
    expect(screen.getByText('binDesigner.slant.longestItem 121')).toBeInTheDocument();
  });

  it('measures the fit from a raised floor, in the compartment that sits lowest', () => {
    const one = { ...DEFAULT_BIN_PARAMS.compartments, cols: 1, rows: 1, cells: [0] };
    setParams({
      slant: { angleDeg: 45, side: 'back' },
      compartments: { ...one, floorRaises: [10] },
    });
    const { unmount } = render(<SlantSection />);
    // 10mm off the 35mm cavity: hypot(81.1 + 25, 25).
    expect(screen.getByText('binDesigner.slant.longestItem 109')).toBeInTheDocument();
    unmount();
    setParams({
      slant: { angleDeg: 45, side: 'back' },
      compartments: { ...one, cols: 2, cells: [0, 1], floorRaises: [10, null] },
      width: 2,
    });
    render(<SlantSection />);
    expect(screen.getByText('binDesigner.slant.longestItem 121')).toBeInTheDocument();
  });

  it('drops the fit length once a divider stands across the lean', () => {
    setParams({
      slant: { angleDeg: 45, side: 'back' },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 1, rows: 2, cells: [0, 1] },
    });
    render(<SlantSection />);
    expect(screen.getByText('binDesigner.slant.topOffset 37')).toBeInTheDocument();
    expect(screen.queryByText(/binDesigner\.slant\.longestItem/)).toBeNull();
  });

  it.each([
    [
      'a scoop ramps into its low corner',
      { scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true } },
    ],
    ['it is a base-only tile', { base: { ...DEFAULT_BIN_PARAMS.base, tile: true }, height: 1 }],
  ])('drops the fit length when %s', (_, over) => {
    setParams({ slant: { angleDeg: 45, side: 'back' }, ...over });
    render(<SlantSection />);
    expect(screen.getByText(/binDesigner\.slant\.topOffset/)).toBeInTheDocument();
    expect(screen.queryByText(/binDesigner\.slant\.longestItem/)).toBeNull();
  });

  it('warns past 45 degrees only', () => {
    setParams({ slant: { angleDeg: 45, side: 'back' } });
    const { unmount } = render(<SlantSection />);
    expect(screen.queryByText('binDesigner.slant.steep')).toBeNull();
    unmount();
    setParams({ slant: { angleDeg: 50, side: 'back' } });
    render(<SlantSection />);
    expect(screen.getByText('binDesigner.slant.steep')).toBeInTheDocument();
  });

  it('turns the end support on and off', () => {
    setParams({ slant: { angleDeg: 45, side: 'back' } });
    render(<SlantSection />);
    const support = screen.getByRole('switch', { name: 'binDesigner.slant.endSupport' });
    fireEvent.click(support);
    expect(params().slant).toEqual({ angleDeg: 45, side: 'back', endSupport: true });
    fireEvent.click(support);
    expect(params().slant).toEqual({ angleDeg: 45, side: 'back' });
  });

  it('names the feature that rules the slant out', () => {
    setParams({ slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true } });
    render(<SlantSection />);
    expect(toggle()).toBeDisabled();
  });

  it('keeps a blocked slant switchable so it can be removed', () => {
    setParams({
      slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true },
      slant: { angleDeg: 45, side: 'back' },
    });
    render(<SlantSection />);
    expect(toggle()).not.toBeDisabled();
    expect(
      screen.getByText('binDesigner.slant.unavailable binDesigner.slideTray.title')
    ).toBeInTheDocument();
  });
});

describe('useSlantVisible', () => {
  function setFlag(enabled: boolean): void {
    useLabsStore.setState((s) => ({
      preferences: {
        ...s.preferences,
        enabledFeatures: { ...s.preferences.enabledFeatures, slant: enabled },
      },
    }));
  }

  it('follows the labs flag', () => {
    setFlag(false);
    expect(renderHook(() => useSlantVisible()).result.current).toBe(false);
    setFlag(true);
    expect(renderHook(() => useSlantVisible()).result.current).toBe(true);
  });

  it('shows for a design that already leans, flag or not', () => {
    setFlag(false);
    setParams({ slant: { angleDeg: 20, side: 'front' } });
    expect(renderHook(() => useSlantVisible()).result.current).toBe(true);
  });
});
