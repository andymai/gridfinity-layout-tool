import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleRow } from './ToggleRow';

describe('ToggleRow', () => {
  it('exposes the label as an accessible checkbox', () => {
    render(<ToggleRow label="Half-grid mode" checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Half-grid mode' })).not.toBeChecked();
  });

  it('reflects the checked state', () => {
    render(<ToggleRow label="Half-grid mode" checked onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Half-grid mode' })).toBeChecked();
  });

  it('prefers ariaLabel over label for the accessible name', () => {
    render(
      <ToggleRow
        label="Half-grid mode"
        ariaLabel="Toggle half-grid mode"
        checked
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('checkbox', { name: 'Toggle half-grid mode' })).toBeInTheDocument();
    expect(screen.getByText('Half-grid mode')).toBeInTheDocument();
  });

  it('fires onChange when the row is clicked', () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Custom drawer shape" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each([' ', 'Enter'])('fires onChange on %s key', (key) => {
    const onChange = vi.fn();
    render(<ToggleRow label="Custom drawer shape" checked={false} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('checkbox'), { key });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated keys', () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Custom drawer shape" checked={false} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the shortcut hint when given', () => {
    render(<ToggleRow label="Half-grid mode" checked={false} onChange={vi.fn()} shortcut="H" />);
    expect(screen.getByText('H')).toBeInTheDocument();
  });

  it('omits the shortcut hint by default', () => {
    render(<ToggleRow label="Custom drawer shape" checked={false} onChange={vi.fn()} />);
    expect(screen.queryByText('H')).not.toBeInTheDocument();
  });

  it('applies the help target to the row so deep-link pulses land on it', () => {
    const { container } = render(
      <ToggleRow
        label="Half-grid mode"
        checked={false}
        onChange={vi.fn()}
        helpTarget="half-bin-mode"
      />
    );
    expect(container.querySelector('[data-help-target="half-bin-mode"]')).toHaveAttribute(
      'role',
      'checkbox'
    );
  });
});
