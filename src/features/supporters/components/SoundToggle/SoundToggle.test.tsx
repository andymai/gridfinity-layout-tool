import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SoundToggle } from './SoundToggle';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('SoundToggle', () => {
  it('offers to turn sound on while it is off', () => {
    const onToggle = vi.fn();
    render(<SoundToggle on={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'supporters.credits.soundOn' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers to turn it off while it is on', () => {
    render(<SoundToggle on onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'supporters.credits.soundOff' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
