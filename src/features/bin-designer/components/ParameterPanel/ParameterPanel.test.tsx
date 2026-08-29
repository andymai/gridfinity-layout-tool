import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ParameterPanel } from './ParameterPanel';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE, DESIGNER_CONSTRAINTS } from '../../constants';

describe('ParameterPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: {
        ...DEFAULT_UI_STATE,
        activeTab: 'dimensions',
        exportDialogOpen: false,
        designListOpen: false,
        wireframeMode: false,
        halfGridMode: false,
        previewCompartments: null,
        previewSelection: null,
      },
    });
  });

  it('renders the category rail', () => {
    render(<ParameterPanel />);

    for (const name of ['Shape', 'Interior', 'Features', 'Style', 'Print']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  describe('category rail', () => {
    it('starts on Shape with the Selection slot disabled', () => {
      render(<ParameterPanel />);

      expect(screen.getByRole('tab', { name: 'Shape' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Selection' })).toBeDisabled();
    });

    it('switches pages when a category is picked', () => {
      render(<ParameterPanel />);

      fireEvent.click(screen.getByRole('tab', { name: 'Style' }));
      expect(screen.getByRole('tab', { name: 'Style' })).toHaveAttribute('aria-selected', 'true');
      expect(useDesignerStore.getState().ui.activeCategory).toBe('style');
    });

    it('marks a category whose params moved off the defaults', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true } },
      });
      render(<ParameterPanel />);
      const interiorTab = screen.getByRole('tab', { name: 'Interior' });
      expect(interiorTab.querySelector('[data-testid="rail-modified-dot"]')).not.toBeNull();
      const shapeTab = screen.getByRole('tab', { name: 'Shape' });
      expect(shapeTab.querySelector('[data-testid="rail-modified-dot"]')).toBeNull();
    });
  });

  it('renders dimension and wall controls directly (no section headers)', () => {
    render(<ParameterPanel />);

    // Sections no longer have CollapsibleSection titles — controls render directly
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByText('Wall thickness')).toBeInTheDocument();
  });

  it('renders section headers including lazy-loaded interior', async () => {
    render(<ParameterPanel />);

    await waitFor(() => {
      expect(screen.getByText('Grid Dividers')).toBeInTheDocument();
    });
  });

  it('renders dimension sliders', () => {
    render(<ParameterPanel />);

    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
  });

  it('renders base feature toggles', () => {
    render(<ParameterPanel />);

    // Base section is expanded by default — no tab click needed
    expect(screen.getByText('Magnet holes')).toBeInTheDocument();
    expect(screen.getByText('Screw holes')).toBeInTheDocument();
    expect(screen.getByText('Stacking lip')).toBeInTheDocument();
  });

  it('shows mm info for dimensions', () => {
    render(<ParameterPanel />);

    // 84 × 84 × 21 mm = width 2 / depth 2 / height 3 at gridUnitMm 42, heightUnitMm 7.
    expect(screen.getByText(/84\s*×\s*84\s*×\s*21\s*mm/)).toBeInTheDocument();
  });

  it('swap button swaps width and depth values', () => {
    // Set different width and depth so swap is visible
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 4 },
    });
    render(<ParameterPanel />);

    const widthInput = screen.getByLabelText<HTMLInputElement>('Width');
    const depthInput = screen.getByLabelText<HTMLInputElement>('Depth');
    expect(widthInput.value).toBe('2');
    expect(depthInput.value).toBe('4');

    // Click swap button
    const swapBtn = screen.getByLabelText('Swap width and depth');
    fireEvent.click(swapBtn);

    // Values should be swapped
    expect(useDesignerStore.getState().params.width).toBe(4);
    expect(useDesignerStore.getState().params.depth).toBe(2);
  });

  it('toggling magnet holes updates base style', () => {
    render(<ParameterPanel />);

    const magnetToggle = screen.getByRole('switch', { name: 'Magnet holes' });
    fireEvent.click(magnetToggle);

    expect(useDesignerStore.getState().params.base.style).toBe('magnet');
  });

  it('toggling screw holes updates base style', () => {
    render(<ParameterPanel />);

    const screwToggle = screen.getByRole('switch', { name: 'Screw holes' });
    fireEvent.click(screwToggle);

    expect(useDesignerStore.getState().params.base.style).toBe('screw');
  });

  it('toggling both magnet and screw sets magnet_and_screw style', () => {
    render(<ParameterPanel />);

    const magnetToggle = screen.getByRole('switch', { name: 'Magnet holes' });
    const screwToggle = screen.getByRole('switch', { name: 'Screw holes' });

    fireEvent.click(magnetToggle);
    fireEvent.click(screwToggle);

    expect(useDesignerStore.getState().params.base.style).toBe('magnet_and_screw');
  });

  it('toggling stacking lip updates base config', () => {
    render(<ParameterPanel />);

    // Default is stacking lip ON
    expect(useDesignerStore.getState().params.base.stackingLip).toBe(true);

    const lipToggle = screen.getByRole('switch', { name: 'Stacking lip' });
    fireEvent.click(lipToggle);

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(false);
  });

  it('dimension steppers respect constraints (default: whole-unit mode)', () => {
    render(<ParameterPanel />);

    const widthInput = screen.getByLabelText('Width');
    expect(widthInput).toHaveAttribute('min', '1');
    expect(widthInput).toHaveAttribute('max', '16');
    expect(widthInput).toHaveAttribute('step', '1');

    const heightInput = screen.getByLabelText('Height');
    expect(heightInput).toHaveAttribute('min', '2');
    expect(heightInput).toHaveAttribute('max', String(DESIGNER_CONSTRAINTS.MAX_HEIGHT));
    expect(heightInput).toHaveAttribute('step', '1');
  });

  it('dimension steppers use 0.5 step when half-bin mode is enabled', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfGridMode: true },
    });
    render(<ParameterPanel />);

    const widthInput = screen.getByLabelText('Width');
    expect(widthInput).toHaveAttribute('min', '0.5');
    expect(widthInput).toHaveAttribute('step', '0.5');

    const depthInput = screen.getByLabelText('Depth');
    expect(depthInput).toHaveAttribute('min', '0.5');
    expect(depthInput).toHaveAttribute('step', '0.5');

    // Height is always integer units regardless of half-bin mode
    const heightInput = screen.getByLabelText('Height');
    expect(heightInput).toHaveAttribute('step', '1');
  });

  describe('conditional magnet/screw sliders', () => {
    it('does not show magnet sliders when magnet is off', () => {
      render(<ParameterPanel />);

      expect(screen.queryByLabelText('Magnet diameter')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Magnet depth')).not.toBeInTheDocument();
    });

    it('shows magnet sliders when magnet is toggled on and Customize clicked', () => {
      render(<ParameterPanel />);

      const magnetToggle = screen.getByRole('switch', { name: 'Magnet holes' });
      fireEvent.click(magnetToggle);

      // Click "Customize" to reveal detailed sliders
      const customizeBtn = screen.getAllByText('Customize')[0];
      fireEvent.click(customizeBtn);

      expect(screen.getByRole('slider', { name: 'Magnet diameter' })).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: 'Magnet depth' })).toBeInTheDocument();
    });

    it('does not show screw slider when screw is off', () => {
      render(<ParameterPanel />);

      expect(screen.queryByLabelText('Screw diameter')).not.toBeInTheDocument();
    });

    it('shows screw slider when screw is toggled on and Customize clicked', () => {
      render(<ParameterPanel />);

      const screwToggle = screen.getByRole('switch', { name: 'Screw holes' });
      fireEvent.click(screwToggle);

      // Click "Customize" for screw settings
      const customizeBtns = screen.getAllByText('Customize');
      fireEvent.click(customizeBtns[0]);

      expect(screen.getByRole('slider', { name: 'Screw diameter' })).toBeInTheDocument();
    });

    it('magnet diameter slider updates magnetDiameter directly', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
        },
      });

      render(<ParameterPanel />);

      // Click Customize to reveal sliders
      const customizeBtn = screen.getAllByText('Customize')[0];
      fireEvent.click(customizeBtn);

      const diameterSlider = screen.getByRole('slider', { name: 'Magnet diameter' });
      fireEvent.change(diameterSlider, { target: { value: '6.5' } });

      expect(useDesignerStore.getState().params.base.magnetDiameter).toBe(6.5);
    });

    it('magnet depth slider updates magnetDepth', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
        },
      });

      render(<ParameterPanel />);

      // Click Customize to reveal sliders
      const customizeBtn = screen.getAllByText('Customize')[0];
      fireEvent.click(customizeBtn);

      const depthSlider = screen.getByRole('slider', { name: 'Magnet depth' });
      fireEvent.change(depthSlider, { target: { value: '3.0' } });

      expect(useDesignerStore.getState().params.base.magnetDepth).toBe(3.0);
    });

    it('screw diameter slider updates screwDiameter directly', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw' },
        },
      });

      render(<ParameterPanel />);

      // Click Customize to reveal sliders
      const customizeBtn = screen.getAllByText('Customize')[0];
      fireEvent.click(customizeBtn);

      const diameterSlider = screen.getByRole('slider', { name: 'Screw diameter' });
      fireEvent.change(diameterSlider, { target: { value: '4.0' } });

      expect(useDesignerStore.getState().params.base.screwDiameter).toBe(4.0);
    });
  });

  describe('walls section', () => {
    it('shows wall thickness slider (expanded by default)', () => {
      const { container } = render(<ParameterPanel />);

      // SnappingSlider has both a div and hidden input with slider role - query the visible div
      const sliderDiv = container.querySelector('div[role="slider"][aria-label*="Wall thickness"]');
      expect(sliderDiv).toBeInTheDocument();
    });

    it('wall thickness slider shows tick marks for options', () => {
      render(<ParameterPanel />);

      // Labelled stops are spaced to clear each other, so 2.4 stays unlabelled
      // next to the 2.6 end stop.
      expect(screen.getByLabelText('Select 0.4mm')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 1.2mm')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 2.6mm')).toBeInTheDocument();
    });

    it('clicking a tick mark updates the store', () => {
      render(<ParameterPanel />);

      fireEvent.click(screen.getByLabelText('Select 1.6mm'));

      expect(useDesignerStore.getState().params.wallThickness).toBe(1.6);
    });
  });

  describe('interior section', () => {
    it('renders compartment grid controls', async () => {
      render(<ParameterPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText('Columns')).toBeInTheDocument();
        expect(screen.getByLabelText('Rows')).toBeInTheDocument();
      });
    });
  });
});
