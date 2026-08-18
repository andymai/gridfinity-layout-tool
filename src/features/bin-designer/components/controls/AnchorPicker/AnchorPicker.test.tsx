import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnchorPicker } from './AnchorPicker';

describe('AnchorPicker', () => {
  it('renders all nine anchor points as one radio group', () => {
    render(<AnchorPicker value="center" onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(9);
  });

  it('marks only the active anchor as checked', () => {
    render(<AnchorPicker value="bottom-left" onChange={vi.fn()} />);
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });

  it('reports the picked anchor', async () => {
    const onChange = vi.fn();
    render(<AnchorPicker value="center" onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('radio')[0]);
    expect(onChange).toHaveBeenCalledWith('top-left');
  });

  it('does not report while disabled', async () => {
    const onChange = vi.fn();
    render(<AnchorPicker value="center" onChange={onChange} disabled />);
    await userEvent.click(screen.getAllByRole('radio')[0]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
