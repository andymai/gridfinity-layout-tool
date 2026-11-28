import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { YearStage } from './YearStage';

describe('YearStage', () => {
  it('frames its content under the kicker and closes on request', () => {
    const onClose = vi.fn();
    render(
      <YearStage
        colours={{ bg: '#FF6A1F', ink: '#2A0618' }}
        onClose={onClose}
        header={<div>progress</div>}
      >
        <p>card body</p>
      </YearStage>
    );
    expect(screen.getByText('Your 2026')).toBeInTheDocument();
    expect(screen.getByText('progress')).toBeInTheDocument();
    expect(screen.getByText('card body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("draws the controls in the card's ink on the card's colour", () => {
    render(
      <YearStage colours={{ bg: '#FF6A1F', ink: '#2A0618' }} onClose={vi.fn()}>
        <p>card body</p>
      </YearStage>
    );
    expect(screen.getByRole('main')).toHaveStyle({ color: '#2A0618' });
    expect(screen.getByText('card body').closest('main > div')).toHaveStyle({
      background: '#FF6A1F',
    });
  });
});
