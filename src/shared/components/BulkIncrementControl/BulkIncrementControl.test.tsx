import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkIncrementControl } from './BulkIncrementControl';

describe('BulkIncrementControl', () => {
  const defaultProps = {
    displayValue: '4u',
    onStep: vi.fn(),
    ariaLabelPrefix: 'height',
  };

  it('displays the value', () => {
    render(<BulkIncrementControl {...defaultProps} />);
    expect(screen.getByText('4u')).toBeInTheDocument();
  });

  it('calls onStep with -1 when decrease clicked', () => {
    const onStep = vi.fn();
    render(<BulkIncrementControl {...defaultProps} onStep={onStep} />);
    fireEvent.click(screen.getByLabelText('Decrease height'));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it('calls onStep with +1 when increase clicked', () => {
    const onStep = vi.fn();
    render(<BulkIncrementControl {...defaultProps} onStep={onStep} />);
    fireEvent.click(screen.getByLabelText('Increase height'));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('disables decrease button when decreaseDisabled', () => {
    render(<BulkIncrementControl {...defaultProps} decreaseDisabled />);
    expect(screen.getByLabelText('Decrease height')).toBeDisabled();
  });

  it('disables increase button when increaseDisabled', () => {
    render(<BulkIncrementControl {...defaultProps} increaseDisabled />);
    expect(screen.getByLabelText('Increase height')).toBeDisabled();
  });
});
