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
});
