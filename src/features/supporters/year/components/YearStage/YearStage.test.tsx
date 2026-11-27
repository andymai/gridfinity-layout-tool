import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { YearStage } from './YearStage';

describe('YearStage', () => {
  it('frames its content under the kicker and closes on request', () => {
    const onClose = vi.fn();
    render(
      <YearStage accent="#3b82f6" onClose={onClose} header={<div>progress</div>}>
        <p>card body</p>
      </YearStage>
    );
    expect(screen.getByText('Your 2026')).toBeInTheDocument();
    expect(screen.getByText('progress')).toBeInTheDocument();
    expect(screen.getByText('card body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
