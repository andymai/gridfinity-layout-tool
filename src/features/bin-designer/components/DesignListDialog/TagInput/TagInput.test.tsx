// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagInput } from './TagInput';

describe('TagInput', () => {
  it('commits a tag on Enter and clears the draft', () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'kitchen' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['kitchen']);
  });

  it('does not add a duplicate (case-insensitive)', () => {
    const onChange = vi.fn();
    render(<TagInput value={['Kitchen']} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'kitchen' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a tag via its remove button', () => {
    const onChange = vi.fn();
    render(<TagInput value={['kitchen', 'screws']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/kitchen/i));
    expect(onChange).toHaveBeenCalledWith(['screws']);
  });

  it('Backspace on an empty draft drops the last tag', () => {
    const onChange = vi.fn();
    render(<TagInput value={['kitchen', 'screws']} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['kitchen']);
  });
});
