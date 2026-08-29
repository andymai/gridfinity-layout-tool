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
  it('marks only the current value as checked', () => {
    render(<SegmentGrid aria-label="Pick" value="b" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
  });

  it('reports a newly picked value and respects disabled options', async () => {
    const onChange = vi.fn();
    render(<SegmentGrid aria-label="Pick" value="a" onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeDisabled();
  });

  it('treats re-picking the current option as a no-op', async () => {
    const onChange = vi.fn();
    render(<SegmentGrid aria-label="Pick" value="a" onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves selection with arrows and Home/End, skipping disabled options', async () => {
    const onChange = vi.fn();
    render(<SegmentGrid aria-label="Pick" value="a" onChange={onChange} options={OPTIONS} />);
    const alpha = screen.getByRole('radio', { name: 'Alpha' });
    alpha.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});
