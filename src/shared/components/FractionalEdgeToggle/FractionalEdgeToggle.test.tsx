import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FractionalEdgeToggle } from './FractionalEdgeToggle';

describe('FractionalEdgeToggle', () => {
  const defaultProps = {
    axis: 'x' as const,
    label: 'Width',
    value: 'end' as const,
    onChange: vi.fn(),
    startTitle: 'Place on left',
    startLabel: 'Left',
    endTitle: 'Place on right',
    endLabel: 'Right',
  };

  it('renders label and both buttons', () => {
    render(<FractionalEdgeToggle {...defaultProps} />);
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('calls onChange with axis and start when start button clicked', () => {
    const onChange = vi.fn();
    render(<FractionalEdgeToggle {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Left'));
    expect(onChange).toHaveBeenCalledWith('x', 'start');
  });

  it('calls onChange with axis and end when end button clicked', () => {
    const onChange = vi.fn();
    render(<FractionalEdgeToggle {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Right'));
    expect(onChange).toHaveBeenCalledWith('x', 'end');
  });

  it('passes axis through to onChange for y axis', () => {
    const onChange = vi.fn();
    render(
      <FractionalEdgeToggle
        {...defaultProps}
        axis="y"
        onChange={onChange}
        startLabel="Bottom"
        endLabel="Top"
      />
    );
    fireEvent.click(screen.getByText('Bottom'));
    expect(onChange).toHaveBeenCalledWith('y', 'start');
  });
});
