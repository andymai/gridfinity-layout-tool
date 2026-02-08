import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompactNumberInput } from './CompactNumberInput';

describe('CompactNumberInput', () => {
  it('renders without crashing', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<CompactNumberInput label="W" value={25.5} onChange={vi.fn()} />);

    expect(screen.getByText('25.5')).toBeInTheDocument();
  });

  it('formats integer values without decimal', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('displays the unit when provided', () => {
    render(<CompactNumberInput label="R" value={90} onChange={vi.fn()} unit="°" />);

    expect(screen.getByText('°')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not enter edit mode when disabled', async () => {
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} disabled />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('enters edit mode on click', async () => {
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('10');
    expect(input).toHaveFocus();
  });

  it('commits value on Enter key', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change the value directly
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(25);
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('cancels edit on Escape key', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change the value
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('commits value on blur', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change the value
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('increments value with ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('decrements value with ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(9);
  });

  it('increments by 10x with Shift+ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('decrements by 10x with Shift+ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={20} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');

    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('clamps value to min', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} min={5} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change the value
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('clamps value to max', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} max={15} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change the value
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('prevents decrement below min with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={5} onChange={onChange} min={5} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('prevents increment above max with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={15} onChange={onChange} max={15} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('ignores invalid input', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change to invalid text
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Component exits edit mode but doesn't call onChange with invalid value
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });
});
