import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Combobox, type ComboboxGhost, type ComboboxOption } from './Combobox';

const OPTIONS: ComboboxOption[] = [
  { value: 'M5 screws', hint: 'next in set' },
  { value: 'Bolts', hint: 'used ×2' },
];

function Harness({
  options = OPTIONS,
  ghost = null,
  onCommit,
  initial = '',
  openOnFocus = true,
  enableInlineGhost = true,
}: {
  options?: ComboboxOption[];
  ghost?: ComboboxGhost | null;
  onCommit?: (value: string, meta: { viaGhost: boolean; option?: ComboboxOption }) => void;
  initial?: string;
  openOnFocus?: boolean;
  enableInlineGhost?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Combobox
      aria-label="Label"
      value={value}
      onChange={setValue}
      onCommit={onCommit}
      options={options}
      ghost={ghost}
      openOnFocus={openOnFocus}
      enableInlineGhost={enableInlineGhost}
      maxLength={24}
      placeholder="Optional label"
    />
  );
}

describe('Combobox', () => {
  it('is a combobox that opens its listbox on focus', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Label' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('navigates with arrows and commits the active option on Enter', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [value, meta] = onCommit.mock.calls[0];
    expect(value).toBe('Bolts');
    expect(meta.viaGhost).toBe(false);
    expect(meta.option?.value).toBe('Bolts');
  });

  it('commits an option on click', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    const option = screen.getByText('M5 screws');
    fireEvent.mouseDown(option);
    fireEvent.click(option);

    const [value] = onCommit.mock.calls[0];
    expect(value).toBe('M5 screws');
  });

  it('accepts the ghost completion on Tab', () => {
    const onCommit = vi.fn();
    const ghost: ComboboxGhost = { value: 'M5 screws', completion: 'M5 screws' };
    render(<Harness ghost={ghost} onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [value, meta] = onCommit.mock.calls[0];
    expect(value).toBe('M5 screws');
    expect(meta.viaGhost).toBe(true);
  });

  it('does not render the ghost overlay when inline ghost is disabled', () => {
    const ghost: ComboboxGhost = { value: 'Widget', completion: 'idget' };
    render(<Harness initial="W" ghost={ghost} enableInlineGhost={false} onCommit={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.focus(input);
    expect(screen.queryByText('idget')).not.toBeInTheDocument();
  });

  it('closes the listbox on Escape but keeps the value', () => {
    render(<Harness initial="scr" />);
    const input = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('scr');
  });

  it('clamps typed input to maxLength', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.change(input, { target: { value: 'x'.repeat(30) } });
    expect(input).toHaveValue('x'.repeat(24));
  });
});
