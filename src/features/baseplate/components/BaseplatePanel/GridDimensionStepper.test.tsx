import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CONSTRAINTS } from '@/core/constants';
import { GridDimensionStepper } from './GridDimensionStepper';

describe('GridDimensionStepper', () => {
  it('renders the label and a control addressable by it', () => {
    render(
      <GridDimensionStepper
        label="Width"
        value={5}
        onChange={vi.fn()}
        halfGridMode={false}
        disabled={false}
      />
    );
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase Width')).toBeInTheDocument();
  });

  it('steps by 1 in whole-grid mode', () => {
    const onChange = vi.fn();
    render(
      <GridDimensionStepper
        label="Width"
        value={5}
        onChange={onChange}
        halfGridMode={false}
        disabled={false}
      />
    );
    fireEvent.click(screen.getByLabelText('Increase Width'));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('steps by 0.5 in half-grid mode', () => {
    const onChange = vi.fn();
    render(
      <GridDimensionStepper
        label="Depth"
        value={5}
        onChange={onChange}
        halfGridMode
        disabled={false}
      />
    );
    fireEvent.click(screen.getByLabelText('Increase Depth'));
    expect(onChange).toHaveBeenCalledWith(5.5);
  });

  it('disables the increase button at GRID_MAX', () => {
    const onChange = vi.fn();
    render(
      <GridDimensionStepper
        label="Width"
        value={CONSTRAINTS.GRID_MAX}
        onChange={onChange}
        halfGridMode={false}
        disabled={false}
      />
    );
    expect(screen.getByLabelText('Increase Width')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Increase Width'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
