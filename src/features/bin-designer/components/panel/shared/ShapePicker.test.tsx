import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShapePicker } from './ShapePicker';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

describe('ShapePicker', () => {
  it('marks the selected option as pressed', () => {
    render(<ShapePicker options={OPTIONS} value="b" onChange={() => {}} ariaLabel="Shape" />);
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<ShapePicker options={OPTIONS} value="a" onChange={onChange} ariaLabel="Shape" />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
