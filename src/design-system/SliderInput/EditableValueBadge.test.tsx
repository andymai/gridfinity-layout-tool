import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableValueBadge } from './EditableValueBadge';

const base = { label: 'Left', min: 0, max: 21, step: 0.5 };

function open(value = 4): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(<EditableValueBadge {...base} value={value} onChange={onChange} unit="mm" />);
  fireEvent.click(screen.getByRole('button'));
  return { onChange };
}

describe('EditableValueBadge', () => {
  it('commits a typed value on Enter', () => {
    const { onChange } = open();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '7.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(7.5);
  });

  it('discards the draft on Escape', () => {
    const { onChange } = open();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps to max and snaps to the step grid', () => {
    const { onChange } = open();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(21);
  });

  it('snaps an off-grid entry to the nearest step', () => {
    const { onChange } = open();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '6.3' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(6.5);
  });

  it('ignores a non-numeric entry', () => {
    const { onChange } = open();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders `display` in place of the value but still edits the value', () => {
    const onChange = vi.fn();
    render(
      <EditableValueBadge {...base} value={21} onChange={onChange} unit="mm" display="21 of 21" />
    );
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('21 of 21');
    fireEvent.click(button);
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('21');
  });

  it('reports edit-mode transitions so a caller can retarget its label', () => {
    const onEditingChange = vi.fn();
    render(
      <EditableValueBadge
        {...base}
        value={4}
        onChange={vi.fn()}
        onEditingChange={onEditingChange}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });

  it('does not open the editor when disabled', () => {
    render(<EditableValueBadge {...base} value={4} onChange={vi.fn()} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
