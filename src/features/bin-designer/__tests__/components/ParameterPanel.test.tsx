import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParameterPanel } from '../../components/ParameterPanel';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

describe('ParameterPanel', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('renders section headings', () => {
    render(<ParameterPanel />);

    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
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

    expect(screen.getByText('Magnet holes')).toBeInTheDocument();
    expect(screen.getByText('Screw holes')).toBeInTheDocument();
    expect(screen.getByText('Stacking lip')).toBeInTheDocument();
  });

  it('shows mm info for dimensions', () => {
    render(<ParameterPanel />);

    // Default width=2 and depth=2 both show 84mm
    const mmLabels = screen.getAllByText('84mm');
    expect(mmLabels.length).toBe(2);
  });

  it('toggling magnet holes updates base style', () => {
    render(<ParameterPanel />);

    const magnetToggle = screen.getByText('Magnet holes').closest('label')!.querySelector('button')!;
    fireEvent.click(magnetToggle);

    expect(useDesignerStore.getState().params.base.style).toBe('magnet');
  });

  it('toggling screw holes updates base style', () => {
    render(<ParameterPanel />);

    const screwToggle = screen.getByText('Screw holes').closest('label')!.querySelector('button')!;
    fireEvent.click(screwToggle);

    expect(useDesignerStore.getState().params.base.style).toBe('screw');
  });

  it('toggling both magnet and screw sets magnet_and_screw style', () => {
    render(<ParameterPanel />);

    const magnetToggle = screen.getByText('Magnet holes').closest('label')!.querySelector('button')!;
    const screwToggle = screen.getByText('Screw holes').closest('label')!.querySelector('button')!;

    fireEvent.click(magnetToggle);
    fireEvent.click(screwToggle);

    expect(useDesignerStore.getState().params.base.style).toBe('magnet_and_screw');
  });

  it('toggling stacking lip updates base config', () => {
    render(<ParameterPanel />);

    // Default is stacking lip ON
    expect(useDesignerStore.getState().params.base.stackingLip).toBe(true);

    const lipToggle = screen.getByText('Stacking lip').closest('label')!.querySelector('button')!;
    fireEvent.click(lipToggle);

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(false);
  });

  it('dimension sliders respect constraints', () => {
    render(<ParameterPanel />);

    const widthSlider = screen.getByLabelText('Width slider');
    expect(widthSlider).toHaveAttribute('min', '0.5');
    expect(widthSlider).toHaveAttribute('max', '8');
    expect(widthSlider).toHaveAttribute('step', '0.5');

    const heightSlider = screen.getByLabelText('Height slider');
    expect(heightSlider).toHaveAttribute('min', '2');
    expect(heightSlider).toHaveAttribute('max', '20');
    expect(heightSlider).toHaveAttribute('step', '1');
  });

  describe('conditional magnet/screw sliders', () => {
    it('does not show magnet sliders when magnet is off', () => {
      render(<ParameterPanel />);

      expect(screen.queryByLabelText('Magnet radius')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Magnet height')).not.toBeInTheDocument();
    });

    it('shows magnet sliders when magnet is toggled on', () => {
      render(<ParameterPanel />);

      const magnetToggle = screen.getByText('Magnet holes').closest('label')!.querySelector('button')!;
      fireEvent.click(magnetToggle);

      expect(screen.getByLabelText('Magnet radius')).toBeInTheDocument();
      expect(screen.getByLabelText('Magnet height')).toBeInTheDocument();
    });

    it('does not show screw slider when screw is off', () => {
      render(<ParameterPanel />);

      expect(screen.queryByLabelText('Screw radius')).not.toBeInTheDocument();
    });

    it('shows screw slider when screw is toggled on', () => {
      render(<ParameterPanel />);

      const screwToggle = screen.getByText('Screw holes').closest('label')!.querySelector('button')!;
      fireEvent.click(screwToggle);

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

      const radiusSlider = screen.getByLabelText('Magnet radius slider');
      fireEvent.change(radiusSlider, { target: { value: '4.0' } });

      expect(useDesignerStore.getState().params.base.magnetDiameter).toBe(8.0);
    });

    it('magnet height slider updates magnetDepth', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
        },
      });

      render(<ParameterPanel />);

      const heightSlider = screen.getByLabelText('Magnet height slider');
      fireEvent.change(heightSlider, { target: { value: '3.0' } });

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

      const radiusSlider = screen.getByLabelText('Screw radius slider');
      fireEvent.change(radiusSlider, { target: { value: '2.0' } });

      expect(useDesignerStore.getState().params.base.screwDiameter).toBe(4.0);
    });
  });

  describe('keepFull toggle and wall thickness', () => {
    it('renders keepFull toggle', () => {
      render(<ParameterPanel />);

      expect(screen.getByText('Keep full (solid)')).toBeInTheDocument();
    });

    it('shows wall thickness slider when keepFull is off (default)', () => {
      render(<ParameterPanel />);

      expect(screen.getByLabelText('Wall thickness')).toBeInTheDocument();
    });

    it('hides wall thickness slider when keepFull is toggled on', () => {
      render(<ParameterPanel />);

      const keepFullToggle = screen
        .getByText('Keep full (solid)')
        .closest('label')!
        .querySelector('button')!;
      fireEvent.click(keepFullToggle);

      expect(screen.queryByLabelText('Wall thickness')).not.toBeInTheDocument();
    });

    it('toggling keepFull sets style to solid', () => {
      render(<ParameterPanel />);

      const keepFullToggle = screen
        .getByText('Keep full (solid)')
        .closest('label')!
        .querySelector('button')!;
      fireEvent.click(keepFullToggle);

      expect(useDesignerStore.getState().params.style).toBe('solid');
    });

    it('toggling keepFull off sets style back to standard', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
      });

      render(<ParameterPanel />);

      const keepFullToggle = screen
        .getByText('Keep full (solid)')
        .closest('label')!
        .querySelector('button')!;
      fireEvent.click(keepFullToggle);

      expect(useDesignerStore.getState().params.style).toBe('standard');
    });

    it('wall thickness slider respects constraints', () => {
      render(<ParameterPanel />);

      const wallSlider = screen.getByLabelText('Wall thickness slider');
      expect(wallSlider).toHaveAttribute('min', '0.8');
      expect(wallSlider).toHaveAttribute('max', '2.4');
      expect(wallSlider).toHaveAttribute('step', '0.1');
    });
  });
});
