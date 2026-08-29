import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentGrid } from './SegmentGrid';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
] as const;

describe('SegmentGrid', () => {
  it('marks only the current value as pressed', () => {
    render(<SegmentGrid aria-label="Pick" value="b" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
  });

  it('reports the picked value and respects disabled options', async () => {
    const onChange = vi.fn();
    render(<SegmentGrid aria-label="Pick" value="a" onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeDisabled();
  });
});
