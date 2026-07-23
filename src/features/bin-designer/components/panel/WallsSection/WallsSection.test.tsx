import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WallsSection } from './WallsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('WallsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders wall thickness slider', () => {
    const { container } = render(<WallsSection />);
    expect(container.querySelector('div[role="slider"]')).toBeInTheDocument();
  });

  it('renders pattern selector with all options', () => {
    render(<WallsSection />);
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

    render(<WallsSection />);
    expect(screen.getByText('Walls with divider slots will keep solid walls')).toBeInTheDocument();
  });

  it('always renders handle section', () => {
    render(<WallsSection />);
    expect(screen.getByText('Handles')).toBeInTheDocument();
  });

  describe('wall text (#2695)', () => {
    it('hides the inputs until the toggle is switched on', () => {
      render(<WallsSection />);
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
      render(<WallsSection />);
      expect(screen.getByRole('textbox', { name: 'Front wall text' })).toBeInTheDocument();
    });

    it('commits a wall string on blur', () => {
      render(<WallsSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Wall text' }));
      const input = screen.getByRole('textbox', { name: 'Front wall text' });
      fireEvent.change(input, { target: { value: 'Cables' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.surfaceText?.walls?.front).toBe('Cables');
    });

    it('collapses an opened-but-empty toggle when the active design switches', () => {
      render(<WallsSection />);
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
          surfaceText: { walls: { front: 'Cables', left: 'USB' }, wallAlign: 'top' },
        },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallsSection />);
      // Auto-opened because text exists; toggling off clears every wall.
      fireEvent.click(screen.getByRole('switch', { name: 'Wall text' }));
      expect(useDesignerStore.getState().params.surfaceText?.walls).toBeUndefined();
      expect(useDesignerStore.getState().params.surfaceText?.wallAlign).toBeUndefined();
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();
    });

    it('shows mode + alignment pickers only when text is present', () => {
      const { unmount } = render(<WallsSection />);
      expect(screen.queryByRole('radio', { name: 'Emboss' })).not.toBeInTheDocument();
      unmount();

      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallsSection />);
      expect(screen.getByRole('radio', { name: 'Emboss' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Top' })).toBeInTheDocument();
    });

    it('alignment picker writes wallAlign', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallsSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Top' }));
      expect(useDesignerStore.getState().params.surfaceText?.wallAlign).toBe('top');
    });

    it('mode picker writes the shared surface style', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, surfaceText: { walls: { front: 'Cables' } } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallsSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Emboss' }));
      expect(useDesignerStore.getState().params.surfaceText?.style?.mode).toBe('emboss');
    });

    it('replaces the inputs with a reason for polygon and solid bins', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } },
        ui: { ...DEFAULT_UI_STATE },
      });
      const { unmount } = render(<WallsSection />);
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();
      expect(screen.getByText('Not available for custom-shape bins.')).toBeInTheDocument();
      unmount();

      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, solid: true } },
        ui: { ...DEFAULT_UI_STATE },
      });
      render(<WallsSection />);
      expect(screen.queryByRole('textbox', { name: 'Front wall text' })).not.toBeInTheDocument();
      expect(screen.getByText('Not available for solid bins.')).toBeInTheDocument();
    });
  });

  it('renders with honeycomb pattern selected', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      },
    });

    render(<WallsSection />);
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('honeycomb');
  });
});
