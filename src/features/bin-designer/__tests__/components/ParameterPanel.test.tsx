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

  it('renders all section headings', () => {
    render(<ParameterPanel />);

    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Walls')).toBeInTheDocument();
  });

  it('renders dimension sliders', () => {
    render(<ParameterPanel />);

    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
  });

  it('renders base style options', () => {
    render(<ParameterPanel />);

    // 'Standard' appears in both Style and Base sections
    expect(screen.getAllByText('Standard').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Magnet')).toBeInTheDocument();
    expect(screen.getByText('Screw')).toBeInTheDocument();
    expect(screen.getByText('Weighted')).toBeInTheDocument();
  });

  it('renders feature controls', () => {
    render(<ParameterPanel />);

    expect(screen.getByLabelText('Dividers X')).toBeInTheDocument();
    expect(screen.getByLabelText('Dividers Y')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable finger scoop')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable label tab')).toBeInTheDocument();
  });

  it('shows vase mode warning in Features section when vase selected', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'vase' },
    });

    render(<ParameterPanel />);

    expect(screen.getByText(/interior features are disabled/i)).toBeInTheDocument();
  });

  it('shows vase mode warning in Walls section when vase selected', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'vase' },
    });

    render(<ParameterPanel />);

    expect(screen.getByText(/wall cutouts are not available/i)).toBeInTheDocument();
  });

  it('selecting magnet base style shows magnet depth slider', () => {
    render(<ParameterPanel />);

    // Click magnet button (unique text in base section)
    const magnetButtons = screen.getAllByText('Magnet');
    fireEvent.click(magnetButtons[0].closest('button')!);

    expect(screen.getByLabelText('Magnet Depth')).toBeInTheDocument();
  });

  it('selecting screw base style shows screw info', () => {
    render(<ParameterPanel />);

    const screwButtons = screen.getAllByText('Screw');
    fireEvent.click(screwButtons[0].closest('button')!);

    expect(screen.getByText(/M3 screw holes/)).toBeInTheDocument();
  });

  it('enabling label shows text input', () => {
    render(<ParameterPanel />);

    const labelCheckbox = screen.getByLabelText('Enable label tab');
    fireEvent.click(labelCheckbox);

    expect(screen.getByLabelText('Label text')).toBeInTheDocument();
  });

  it('adding dividers shows thickness slider', () => {
    render(<ParameterPanel />);

    // Increase dividers X (commit-on-blur pattern)
    const divXInput = screen.getByLabelText('Dividers X');
    fireEvent.focus(divXInput);
    fireEvent.change(divXInput, { target: { value: '2' } });
    fireEvent.blur(divXInput);

    expect(screen.getByLabelText('Divider Thickness')).toBeInTheDocument();
  });

  it('wall sliders update the store', () => {
    render(<ParameterPanel />);

    // Walls section is collapsed by default, expand it
    fireEvent.click(screen.getByText('Walls'));

    const frontSlider = screen.getByLabelText('Front slider');
    fireEvent.change(frontSlider, { target: { value: '50' } });

    expect(useDesignerStore.getState().params.walls.front).toBe(50);
  });

  it('wall values snap to minimum 20% when between 1-19%', () => {
    render(<ParameterPanel />);

    // Expand walls section
    fireEvent.click(screen.getByText('Walls'));

    const frontSlider = screen.getByLabelText('Front slider');
    fireEvent.change(frontSlider, { target: { value: '15' } });

    // Should snap to 20%
    expect(useDesignerStore.getState().params.walls.front).toBe(20);
  });
});
