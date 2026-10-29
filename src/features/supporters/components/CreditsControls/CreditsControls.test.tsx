import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreditsControls } from './CreditsControls';
import { CreditsClock } from '../../utils/creditsClock';
import { HOLD_RATE } from '../../hooks/useRollScrub';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const setup = (over: Partial<React.ComponentProps<typeof CreditsControls>> = {}) => {
  const clock = new CreditsClock(100);
  const props = {
    paused: false,
    stacked: false,
    showHint: false,
    onTogglePause: vi.fn(),
    onSkip: vi.fn(),
    onKofi: vi.fn(),
    ...over,
    clock,
  };
  render(<CreditsControls {...props} />);
  return props;
};

describe('CreditsControls', () => {
  it('fast-forwards while held and lets go on release', () => {
    const { clock } = setup();
    const forward = screen.getByRole('button', { name: 'supporters.credits.fastForward' });
    fireEvent.pointerDown(forward, { pointerId: 1 });
    expect(clock.targetRate).toBe(HOLD_RATE);
    fireEvent.pointerUp(forward, { pointerId: 1 });
    expect(clock.targetRate).toBe(1);
  });

  it('rewinds while held', () => {
    const { clock } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'supporters.credits.rewind' }), {
      pointerId: 1,
    });
    expect(clock.targetRate).toBe(-HOLD_RATE);
  });

  it('jumps instead when pressed from the keyboard', () => {
    const { clock } = setup();
    clock.seek(20);
    fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.rewind' }), {
      detail: 0,
    });
    expect(clock.time).toBe(12);
  });

  it('labels the pause button by what it will do', () => {
    setup({ paused: true });
    expect(screen.getByRole('button', { name: 'supporters.credits.play' })).toBeInTheDocument();
  });

  it('wires pause, skip and the Ko-fi door', () => {
    const { onTogglePause, onSkip, onKofi } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'supporters.cta.button' }));
    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onKofi).toHaveBeenCalledTimes(1);
  });

  it('shows the scrub hint only when asked', () => {
    setup({ showHint: true });
    expect(screen.getByText('supporters.credits.scrubHint')).toBeInTheDocument();
  });
});
