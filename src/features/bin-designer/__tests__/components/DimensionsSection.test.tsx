import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DimensionsSection } from '../../components/parameters/DimensionsSection';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

describe('DimensionsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('renders width, depth, and height sliders', () => {
    render(<DimensionsSection />);

    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
  });

  it('displays mm dimensions for width and depth', () => {
    render(<DimensionsSection />);

    // Default width & depth are both 2 units = 84mm each
    const mmLabels = screen.getAllByText('84mm');
    expect(mmLabels.length).toBe(2);
  });

  it('displays total mm for height (including base)', () => {
    render(<DimensionsSection />);

    // Default height is 3 units = 3*7 + 5 = 26mm total
    expect(screen.getByText('26mm total')).toBeInTheDocument();
  });

  it('renders quick-select buttons for width', () => {
    render(<DimensionsSection />);

    const widthPresets = screen.getByRole('group', { name: 'Width presets' });
    expect(widthPresets).toBeInTheDocument();

    // Should have buttons 1, 2, 3, 4
    const buttons = widthPresets.querySelectorAll('button');
    expect(buttons).toHaveLength(4);
  });

  it('clicking a quick-select button updates the store', () => {
    render(<DimensionsSection />);

    const widthPresets = screen.getByRole('group', { name: 'Width presets' });
    const button3 = widthPresets.querySelector('button:nth-child(3)');
    fireEvent.click(button3!);

    expect(useDesignerStore.getState().params.width).toBe(3);
  });

  it('changing the width slider updates the store', () => {
    render(<DimensionsSection />);

    const slider = screen.getByLabelText('Width slider');
    fireEvent.change(slider, { target: { value: '4' } });

    expect(useDesignerStore.getState().params.width).toBe(4);
  });

  it('changing the number input updates the store', () => {
    render(<DimensionsSection />);

    const input = screen.getByLabelText('Width');
    fireEvent.change(input, { target: { value: '5' } });

    expect(useDesignerStore.getState().params.width).toBe(5);
  });

  it('clamps input value to valid range', () => {
    render(<DimensionsSection />);

    const input = screen.getByLabelText('Width');
    fireEvent.change(input, { target: { value: '10' } });

    // Max is 6
    expect(useDesignerStore.getState().params.width).toBe(6);
  });

  it('snaps width to 0.5 step increments', () => {
    render(<DimensionsSection />);

    const input = screen.getByLabelText('Width');
    fireEvent.change(input, { target: { value: '2.7' } });

    // Should snap to 2.5
    expect(useDesignerStore.getState().params.width).toBe(2.5);
  });

  it('height slider uses integer steps', () => {
    render(<DimensionsSection />);

    const slider = screen.getByLabelText('Height slider');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '12');
  });

  it('height quick-select buttons are 3, 6, 9, 12', () => {
    render(<DimensionsSection />);

    const heightPresets = screen.getByRole('group', { name: 'Height presets' });
    const buttons = heightPresets.querySelectorAll('button');
    expect(buttons[0]).toHaveTextContent('3');
    expect(buttons[1]).toHaveTextContent('6');
    expect(buttons[2]).toHaveTextContent('9');
    expect(buttons[3]).toHaveTextContent('12');
  });
});
