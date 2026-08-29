import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WallSurfaceSection } from './WallSurfaceSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { WallPatternSides } from '@/features/bin-designer/types';

describe('WallSurfaceSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders pattern selector with all options', () => {
    render(<WallSurfaceSection />);
    expect(screen.getByText('Wall pattern')).toBeInTheDocument();
    expect(screen.getByText('Solid')).toBeInTheDocument();
    expect(screen.getByText('Honeycomb')).toBeInTheDocument();
  });

  it('shows partial slot note when some walls slotted and pattern enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });

    render(<WallSurfaceSection />);
    expect(screen.getByText('Walls with divider slots will keep solid walls')).toBeInTheDocument();
  });

  describe('wall text (#2695)', () => {
    it('hides the inputs until the toggle is switched on', () => {
      render(<WallSurfaceSection />);
      expect(screen.getByText('Wall text')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('switch', { name: 'Wall text' }));
      for (const side of ['Front', 'Back', 'Left', 'Right']) {
        expect(screen.getByRole('textbox', { name: `${side} wall text` })).toBeInTheDocument();
      }
    });

    it('opens expanded when the design already has wall text', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      expect(screen.getByRole('textbox', { name: 'Front wall text' })).toBeInTheDocument();
    });

    it('commits a wall string on blur', () => {
      render(<WallSurfaceSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Wall text' }));
      const input = screen.getByRole('textbox', { name: 'Front wall text' });
      fireEvent.change(input, { target: { value: 'Cables' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.surfaceText?.walls?.front).toBe('Cables');
    });

    it('collapses an opened-but-empty toggle when the active design switches', () => {
      render(<WallSurfaceSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Wall text' }));
      expect(screen.getByRole('textbox', { name: 'Front wall text' })).toBeInTheDocument();

      act(() => {
        useDesignerStore.setState({ currentDesignId: 'another-design' });
      });
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();
    });

    it('clears all wall text and collapses when toggled off', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          surfaceText: {
            walls: { front: 'Cables', left: 'USB' },
            wallStyles: { front: { mode: 'emboss' } },
          },
        },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      // Auto-opened because text exists; toggling off clears every wall.
      fireEvent.click(screen.getByRole('switch', { name: 'Wall text' }));
      expect(useDesignerStore.getState().params.surfaceText?.walls).toBeUndefined();
      expect(useDesignerStore.getState().params.surfaceText?.wallStyles).toBeUndefined();
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();
    });

    it('shows mode + anchor pickers only when text is present', () => {
      const { unmount } = render(<WallSurfaceSection />);
      expect(screen.queryByRole('radio', { name: 'Emboss' })).not.toBeInTheDocument();
      unmount();

      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      expect(screen.getByRole('radio', { name: 'Emboss' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Top left' })).toBeInTheDocument();
    });

    it('anchor picker writes the anchor onto the shared surface style', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      // Not 'Bottom left': the default preset already anchors there, so the
      // setter's no-op guard would (correctly) swallow it and the test would
      // pass without the picker being wired to anything.
      fireEvent.click(screen.getByRole('radio', { name: 'Top right' }));
      expect(useDesignerStore.getState().params.surfaceText?.style?.anchor).toBe('top-right');
    });

    it('mode picker writes the shared surface style', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Emboss' }));
      expect(useDesignerStore.getState().params.surfaceText?.style?.mode).toBe('emboss');
    });

    it('replaces the inputs with a reason for polygon bins', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();
      expect(screen.getByText('Not available for custom-shape bins.')).toBeInTheDocument();
    });

    // A solid body has the same outer wall a hollow one does; only the interior
    // features it disables are unavailable.
    it('keeps the inputs on a solid bin', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          style: 'solid',
          base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
          surfaceText: { walls: { front: 'BITS' } },
        },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallSurfaceSection />);
      expect(screen.getByRole('textbox', { name: 'Front wall text' })).toHaveValue('BITS');
      expect(screen.queryByText('Not available for solid bins.')).not.toBeInTheDocument();
    });
  });

  describe('patterned walls (#2966)', () => {
    const patterned = (sides?: WallPatternSides) => ({
      ...DEFAULT_BIN_PARAMS,
      wallPattern: {
        ...DEFAULT_BIN_PARAMS.wallPattern,
        enabled: true,
        ...(sides ? { sides } : {}),
      },
    });

    it('hides the side selector until a pattern is picked', () => {
      render(<WallSurfaceSection />);
      expect(screen.queryByRole('switch', { name: 'Front' })).not.toBeInTheDocument();
    });

    it('shows all four walls selected for a freshly enabled pattern', () => {
      useDesignerStore.setState({ params: patterned() });
      render(<WallSurfaceSection />);
      expect(screen.getByText('Patterned walls')).toBeInTheDocument();
      for (const side of ['Left', 'Right', 'Front', 'Back']) {
        expect(screen.getByRole('switch', { name: side })).toHaveAttribute('aria-checked', 'true');
      }
    });

    it('writes the full side record when a wall is toggled off', () => {
      useDesignerStore.setState({ params: patterned() });
      render(<WallSurfaceSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Back' }));
      expect(useDesignerStore.getState().params.wallPattern.sides).toEqual({
        left: true,
        right: true,
        front: true,
        back: false,
      });
    });

    it('explains an all-deselected pattern instead of silently doing nothing', () => {
      // Compartments present, so the divider checkbox IS available — only then
      // is pointing the user at it actionable.
      useDesignerStore.setState({
        params: {
          ...patterned({ left: false, right: false, front: false, back: false }),
          compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
        },
      });
      render(<WallSurfaceSection />);
      expect(
        screen.getByText('Pick a wall, or pattern the divider walls below')
      ).toBeInTheDocument();
    });

    it('reads an all-deselected pattern with dividers on as dividers-only', () => {
      useDesignerStore.setState({
        params: {
          ...patterned({ left: false, right: false, front: false, back: false }),
          compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
          wallPattern: {
            ...DEFAULT_BIN_PARAMS.wallPattern,
            enabled: true,
            dividers: true,
            sides: { left: false, right: false, front: false, back: false },
          },
        },
      });
      render(<WallSurfaceSection />);
      expect(
        screen.getByText('Outer walls stay solid: only the dividers are patterned')
      ).toBeInTheDocument();
    });

    it('does not point at the divider checkbox when it is disabled', () => {
      // A 1×1 compartment bin has no dividers to pattern, so "or pattern the
      // divider walls below" would send the user to a control they can't enable.
      useDesignerStore.setState({
        params: patterned({ left: false, right: false, front: false, back: false }),
      });
      render(<WallSurfaceSection />);
      expect(screen.getByText('Nothing is patterned: pick at least one wall')).toBeInTheDocument();
      expect(
        screen.queryByText('Pick a wall, or pattern the divider walls below')
      ).not.toBeInTheDocument();
    });

    it('replaces the selector with a reason when kumiko cannot render on this bin', () => {
      // Custom shape: buildKumikoWallPatterns bails on a polygon footprint, so
      // every wall exports solid — the chips must not claim otherwise.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
          wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'mitsukude' },
        },
      });
      const { unmount } = render(<WallSurfaceSection />);
      expect(screen.queryByRole('switch', { name: 'Front' })).not.toBeInTheDocument();
      expect(
        screen.getByText('Kumiko patterns need a rectangular bin, so these walls stay solid')
      ).toBeInTheDocument();
      unmount();

      // Slotted on one axis: the wrap needs all four walls slot-free.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          style: 'slotted',
          slotConfig: {
            ...DEFAULT_BIN_PARAMS.slotConfig,
            x: { enabled: true, pitch: 20 },
            y: { enabled: false, pitch: 20 },
          },
          wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'mitsukude' },
        },
      });
      render(<WallSurfaceSection />);
      expect(screen.queryByRole('switch', { name: 'Front' })).not.toBeInTheDocument();
      expect(
        screen.getByText(
          'Kumiko patterns need all four walls free of divider slots, so these walls stay solid'
        )
      ).toBeInTheDocument();
    });

    it('keeps the selector for a kumiko pattern on a plain rectangular bin', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'mitsukude' },
        },
      });
      render(<WallSurfaceSection />);
      expect(screen.getByRole('switch', { name: 'Front' })).toBeInTheDocument();
    });

    it('disables a slot-blocked wall and explains why', () => {
      useDesignerStore.setState({
        params: {
          ...patterned(),
          style: 'slotted',
          slotConfig: {
            ...DEFAULT_BIN_PARAMS.slotConfig,
            x: { enabled: true, pitch: 20 },
            y: { enabled: false, pitch: 20 },
          },
        },
      });
      render(<WallSurfaceSection />);
      const left = screen.getByRole('switch', { name: 'Left' });
      expect(left).toBeDisabled();
      // Disabled reads as off even though the stored selection is untouched.
      expect(left).toHaveAttribute('aria-checked', 'false');
      expect(left).toHaveAttribute('title', 'This wall has divider slots and stays solid');
      expect(screen.getByRole('switch', { name: 'Front' })).toBeEnabled();
    });
  });

  it('renders with honeycomb pattern selected', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      },
    });

    render(<WallSurfaceSection />);
    const select = screen.getByRole<HTMLSelectElement>('combobox');
    expect(select.value).toBe('honeycomb');
  });
});
