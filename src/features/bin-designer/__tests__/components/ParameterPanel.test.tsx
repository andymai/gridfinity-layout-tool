import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ParameterPanel } from '../../components/ParameterPanel';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

describe('ParameterPanel', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: {
        activeTab: 'dimensions',
        exportDialogOpen: false,
        designListOpen: false,
        wireframeMode: false,
      },
    });
  });

  it('renders section headers', () => {
    render(<ParameterPanel />);

    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Interior')).toBeInTheDocument();
    expect(screen.getByText('Walls')).toBeInTheDocument();
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

    // Default width=2, depth=2, height=3 shows combined dimensions
    // Format: "84 × 84 × 21 mm" (using gridUnitMm=42, heightUnitMm=7)
    expect(screen.getByText(/84\s*×\s*84\s*×\s*21\s*mm/)).toBeInTheDocument();
  });

  it('swap button swaps width and depth values', () => {
    // Set different width and depth so swap is visible
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 4 },
    });
    render(<ParameterPanel />);

    const widthInput = screen.getByLabelText('Width') as HTMLInputElement;
    const depthInput = screen.getByLabelText('Depth') as HTMLInputElement;
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
    expect(widthInput).toHaveAttribute('max', '8');
    expect(widthInput).toHaveAttribute('step', '1');

    const heightInput = screen.getByLabelText('Height');
    expect(heightInput).toHaveAttribute('min', '2');
    expect(heightInput).toHaveAttribute('max', '20');
    expect(heightInput).toHaveAttribute('step', '1');
  });

  it('dimension steppers use 0.5 step when half-bin mode is enabled', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfBinMode: true },
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

      expect(screen.queryByLabelText('Magnet radius')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Magnet depth')).not.toBeInTheDocument();
    });

    it('shows magnet sliders when magnet is toggled on and Customize clicked', () => {
      render(<ParameterPanel />);

      const magnetToggle = screen.getByRole('switch', { name: 'Magnet holes' });
      fireEvent.click(magnetToggle);

      // Click "Customize" to reveal detailed sliders
      const customizeBtn = screen.getAllByText('Customize')[0];
      fireEvent.click(customizeBtn);

      expect(screen.getByLabelText('Magnet radius')).toBeInTheDocument();
      expect(screen.getByLabelText('Magnet depth')).toBeInTheDocument();
    });

    it('does not show screw slider when screw is off', () => {
      render(<ParameterPanel />);

      expect(screen.queryByLabelText('Screw radius')).not.toBeInTheDocument();
    });

    it('shows screw slider when screw is toggled on and Customize clicked', () => {
      render(<ParameterPanel />);

      const screwToggle = screen.getByRole('switch', { name: 'Screw holes' });
      fireEvent.click(screwToggle);

      // Click "Customize" for screw settings
      const customizeBtns = screen.getAllByText('Customize');
      fireEvent.click(customizeBtns[0]);

      expect(screen.getByLabelText('Screw radius')).toBeInTheDocument();
    });

    it('magnet radius slider updates magnetDiameter (radius × 2)', () => {
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

      const radiusSlider = screen.getByLabelText('Magnet radius slider');
      fireEvent.change(radiusSlider, { target: { value: '4.0' } });

      expect(useDesignerStore.getState().params.base.magnetDiameter).toBe(8.0);
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

      const depthSlider = screen.getByLabelText('Magnet depth slider');
      fireEvent.change(depthSlider, { target: { value: '3.0' } });

      expect(useDesignerStore.getState().params.base.magnetDepth).toBe(3.0);
    });

    it('screw radius slider updates screwDiameter (radius × 2)', () => {
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

      const radiusSlider = screen.getByLabelText('Screw radius slider');
      fireEvent.change(radiusSlider, { target: { value: '2.0' } });

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

      // SnappingSlider shows tick buttons for each option
      expect(screen.getByLabelText('Select 0.4mm')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 1.2mm')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 2.4mm')).toBeInTheDocument();
    });

    it('clicking a tick mark updates the store', () => {
      render(<ParameterPanel />);

      fireEvent.click(screen.getByLabelText('Select 1.6mm'));

      expect(useDesignerStore.getState().params.wallThickness).toBe(1.6);
    });
  });

  describe('interior section', () => {
    it('renders compartment grid controls', () => {
      render(<ParameterPanel />);

      expect(screen.getByLabelText('Columns')).toBeInTheDocument();
      expect(screen.getByLabelText('Rows')).toBeInTheDocument();
    });
  });
});
