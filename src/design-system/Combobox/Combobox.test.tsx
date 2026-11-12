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

  it('highlights no option until the arrow keys move the highlight', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    expect(input).not.toHaveAttribute('aria-activedescendant');
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-selected', 'false');
    }

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const [first, second] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
  });

  it('navigates with arrows and commits the active option on Enter', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [value, meta] = onCommit.mock.calls[0];
    expect(value).toBe('Bolts');
    expect(meta.viaGhost).toBe(false);
    expect(meta.option?.value).toBe('Bolts');
    expect(input).toHaveValue('Bolts');
  });

  it('starts ArrowUp at the last option', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toBe('Bolts');
  });

  it('keeps the typed text on Enter when the highlight was not moved', () => {
    const onCommit = vi.fn();
    render(<Harness options={[{ value: 'Screw' }, { value: 'Drill bit' }]} onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Drill bit' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('Drill bit');
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps typed text that only resembles the top suggestion', () => {
    const onCommit = vi.fn();
    render(<Harness options={[{ value: 'Drill bit' }, { value: 'Drills' }]} onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Drill bits' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('Drill bits');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('drops the arrow-key highlight when the user types again', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'Washers' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('Washers');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('drops the arrow-key highlight when the field loses focus', () => {
    const onCommit = vi.fn();
    render(<Harness initial="scr" onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('scr');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not let a pointer hover choose the option that Enter commits', () => {
    const onCommit = vi.fn();
    render(<Harness initial="scr" onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Label' });

    fireEvent.focus(input);
    fireEvent.mouseEnter(screen.getByText('Bolts'));
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('scr');
    expect(onCommit).not.toHaveBeenCalled();
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

  it('accepts the ghost on Tab after typing, while Enter keeps the typed prefix', () => {
    const ghost: ComboboxGhost = { value: 'M5 screws', completion: ' screws' };

    const onTabCommit = vi.fn();
    const { unmount } = render(<Harness initial="M5" ghost={ghost} onCommit={onTabCommit} />);
    const tabInput = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.focus(tabInput);
    fireEvent.keyDown(tabInput, { key: 'Tab' });
    expect(tabInput).toHaveValue('M5 screws');
    expect(onTabCommit).toHaveBeenCalledWith('M5 screws', { viaGhost: true, option: undefined });
    unmount();

    const onEnterCommit = vi.fn();
    render(<Harness initial="M5" ghost={ghost} onCommit={onEnterCommit} />);
    const enterInput = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.focus(enterInput);
    fireEvent.keyDown(enterInput, { key: 'Enter' });
    expect(enterInput).toHaveValue('M5');
    expect(onEnterCommit).not.toHaveBeenCalled();
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

  it('opens a closed empty field on ArrowDown when openOnFocus is off', () => {
    render(<Harness openOnFocus={false} />);
    const input = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('clamps typed input to maxLength', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Label' });
    fireEvent.change(input, { target: { value: 'x'.repeat(30) } });
    expect(input).toHaveValue('x'.repeat(24));
  });
});
