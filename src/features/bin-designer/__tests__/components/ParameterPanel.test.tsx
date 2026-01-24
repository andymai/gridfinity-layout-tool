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

    // Default width=2, depth=2 both show 84mm
    const mmLabels = screen.getAllByText('84mm');
    expect(mmLabels.length).toBe(2);
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
    it('shows wall thickness selector (expanded by default)', () => {
      render(<ParameterPanel />);

      expect(screen.getByLabelText('Wall thickness')).toBeInTheDocument();
    });

    it('wall thickness selector shows discrete options', () => {
      render(<ParameterPanel />);

      const thicknessGroup = screen.getByRole('radiogroup', { name: 'Wall thickness' });
      const options = within(thicknessGroup).getAllByRole('radio');
      expect(options).toHaveLength(8);
      expect(screen.getByLabelText('0.4mm')).toBeInTheDocument();
      expect(screen.getByLabelText('1.2mm')).toBeInTheDocument();
      expect(screen.getByLabelText('2.4mm')).toBeInTheDocument();
    });

    it('clicking a thickness option updates the store', () => {
      render(<ParameterPanel />);

      fireEvent.click(screen.getByLabelText('1.6mm'));

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
