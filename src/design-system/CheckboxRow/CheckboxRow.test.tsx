import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { CheckboxRow } from './CheckboxRow';

const defaultProps = {
  label: 'Include labels',
  checked: false,
  onChange: vi.fn(),
};

describe('CheckboxRow', () => {
  it('renders a checkbox role with the accessible label', () => {
    render(<CheckboxRow {...defaultProps} />);
    expect(screen.getByRole('checkbox', { name: 'Include labels' })).toBeInTheDocument();
  });

  it('reflects checked state via aria-checked', () => {
    const { rerender } = render(<CheckboxRow {...defaultProps} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');

    rerender(<CheckboxRow {...defaultProps} checked />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('exposes a single accessible checkbox (inner visual is hidden)', () => {
    render(<CheckboxRow {...defaultProps} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('calls onChange with the toggled value on click', () => {
    const onChange = vi.fn();
    render(<CheckboxRow {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when clicking a checked row', () => {
    const onChange = vi.fn();
    render(<CheckboxRow {...defaultProps} checked onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('toggles on Space and prevents default', () => {
    const onChange = vi.fn();
    render(<CheckboxRow {...defaultProps} onChange={onChange} />);

    const row = screen.getByRole('checkbox');
    const event = createEvent.keyDown(row, { key: ' ' });
    fireEvent(row, event);

    expect(onChange).toHaveBeenCalledWith(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('toggles on Enter and prevents default', () => {
    const onChange = vi.fn();
    render(<CheckboxRow {...defaultProps} onChange={onChange} />);

    const row = screen.getByRole('checkbox');
    const event = createEvent.keyDown(row, { key: 'Enter' });
    fireEvent(row, event);

    expect(onChange).toHaveBeenCalledWith(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores other keys', () => {
    const onChange = vi.fn();
    render(<CheckboxRow {...defaultProps} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is focusable when enabled', () => {
    render(<CheckboxRow {...defaultProps} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('tabindex', '0');
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<CheckboxRow {...defaultProps} onChange={onChange} disabled />);

    const row = screen.getByRole('checkbox');
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: ' ' });
    fireEvent.keyDown(row, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets aria-disabled and removes from tab order when disabled', () => {
    render(<CheckboxRow {...defaultProps} disabled />);

    const row = screen.getByRole('checkbox');
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row).toHaveAttribute('tabindex', '-1');
  });

  it('renders the trailing slot', () => {
    render(<CheckboxRow {...defaultProps} trailing={<span data-testid="count">12</span>} />);
    expect(screen.getByTestId('count')).toHaveTextContent('12');
  });

  it('applies indent classes when indent is set', () => {
    render(<CheckboxRow {...defaultProps} indent />);

    const row = screen.getByRole('checkbox');
    expect(row).toHaveClass('ml-4', 'border-l', 'border-stroke-subtle', 'pl-3');
  });

  it('does not apply indent classes by default', () => {
    render(<CheckboxRow {...defaultProps} />);
    expect(screen.getByRole('checkbox')).not.toHaveClass('ml-4');
  });

  it('dims the label when unchecked and brightens it when checked', () => {
    const { rerender } = render(<CheckboxRow {...defaultProps} />);
    expect(screen.getByText('Include labels')).toHaveClass('text-content-tertiary');

    rerender(<CheckboxRow {...defaultProps} checked />);
    expect(screen.getByText('Include labels')).toHaveClass('text-content');
  });

  it('applies className to the row container', () => {
    render(<CheckboxRow {...defaultProps} className="custom-class" />);
    expect(screen.getByRole('checkbox')).toHaveClass('custom-class');
  });

  it('forwards ref to the row element', () => {
    const ref = vi.fn();
    render(<CheckboxRow {...defaultProps} ref={ref} />);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });
});
