import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThicknessSelector } from './ThicknessSelector';

describe('ThicknessSelector', () => {
  const defaultProps = {
    label: 'Wall Thickness',
    value: 1.2,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ThicknessSelector {...defaultProps} />);
    expect(screen.getByText('Wall Thickness')).toBeInTheDocument();
  });

  it('displays current value', () => {
    render(<ThicknessSelector {...defaultProps} value={1.6} />);
    expect(screen.getByText('1.6 mm')).toBeInTheDocument();
  });

  it('shows all thickness options', () => {
    render(<ThicknessSelector {...defaultProps} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('marks active option', () => {
    render(<ThicknessSelector {...defaultProps} value={1.2} />);
    const activeButton = screen.getByLabelText('1.2mm');
    expect(activeButton).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when option clicked', () => {
    render(<ThicknessSelector {...defaultProps} />);
    const option = screen.getByLabelText('1.6mm');
    fireEvent.click(option);
    expect(defaultProps.onChange).toHaveBeenCalledWith(1.6);
  });

  it('supports keyboard navigation with arrow keys', () => {
    render(<ThicknessSelector {...defaultProps} value={1.2} />);
    const activeButton = screen.getByLabelText('1.2mm');

    fireEvent.keyDown(activeButton, { key: 'ArrowRight' });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('supports Home key to go to first option', () => {
    render(<ThicknessSelector {...defaultProps} value={1.6} />);
    const activeButton = screen.getByLabelText('1.6mm');

    fireEvent.keyDown(activeButton, { key: 'Home' });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('supports End key to go to last option', () => {
    render(<ThicknessSelector {...defaultProps} value={1.2} />);
    const activeButton = screen.getByLabelText('1.2mm');

    fireEvent.keyDown(activeButton, { key: 'End' });
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<ThicknessSelector {...defaultProps} disabled={true} />);
    const buttons = screen.getAllByRole('radio');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('does not call onChange when disabled', () => {
    render(<ThicknessSelector {...defaultProps} disabled={true} />);
    const option = screen.getByLabelText('1.6mm');
    fireEvent.click(option);
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });
});
