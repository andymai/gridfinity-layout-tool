import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemSearch } from './ItemSearch';

describe('ItemSearch', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: 'Search bins...',
    ariaLabel: 'Search',
    clearAriaLabel: 'Clear search',
  };

  it('renders input with placeholder', () => {
    render(<ItemSearch {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search bins...')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<ItemSearch {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('does not show clear button when empty', () => {
    render(<ItemSearch {...defaultProps} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('shows clear button when value is non-empty', () => {
    render(<ItemSearch {...defaultProps} value="screws" />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears input when clear button clicked', () => {
    const onChange = vi.fn();
    render(<ItemSearch {...defaultProps} value="screws" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('has correct aria-label', () => {
    render(<ItemSearch {...defaultProps} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search');
  });
});
