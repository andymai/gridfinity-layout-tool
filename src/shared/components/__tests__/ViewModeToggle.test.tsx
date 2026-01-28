import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewModeToggle } from '../ViewModeToggle';

describe('ViewModeToggle', () => {
  const defaultProps = {
    value: 'list' as const,
    onChange: vi.fn(),
    ariaLabel: 'View mode',
    listLabel: 'List view',
    gridLabel: 'Grid view',
  };

  it('renders list and grid buttons', () => {
    render(<ViewModeToggle {...defaultProps} />);

    expect(screen.getByRole('radio', { name: 'List view' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grid view' })).toBeInTheDocument();
  });

  it('marks list as selected when value is list', () => {
    render(<ViewModeToggle {...defaultProps} value="list" />);

    expect(screen.getByRole('radio', { name: 'List view' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks grid as selected when value is grid', () => {
    render(<ViewModeToggle {...defaultProps} value="grid" />);

    expect(screen.getByRole('radio', { name: 'List view' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with list when list button clicked', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle {...defaultProps} value="grid" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'List view' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('calls onChange with grid when grid button clicked', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle {...defaultProps} value="list" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Grid view' }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('navigates to list on ArrowLeft', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle {...defaultProps} value="grid" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('navigates to grid on ArrowRight', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle {...defaultProps} value="list" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('navigates to list on Home', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle {...defaultProps} value="grid" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('navigates to grid on End', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle {...defaultProps} value="list" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('has proper radiogroup role', () => {
    render(<ViewModeToggle {...defaultProps} />);

    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', 'View mode');
  });
});
