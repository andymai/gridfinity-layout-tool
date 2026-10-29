import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CreditsTitleCard } from './CreditsTitleCard';
import { CreditsClock } from '../../utils/creditsClock';
import { INTRO_SECONDS } from '../../utils/rollSchedule';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const LINE_1 = 'supporters.credits.victoryLine1';

describe('CreditsTitleCard', () => {
  it('gives screen readers the whole card at once', () => {
    render(<CreditsTitleCard clock={new CreditsClock(60)} count={248} accent="#f59e0b" />);
    const summary = screen.getByText(/supporters\.credits\.madePossibleBy/, {
      selector: '.sr-only',
    });
    expect(summary).toHaveTextContent(LINE_1);
    expect(summary).toHaveTextContent('248 supporters.credits.people.other');
  });

  it('uses the singular for one supporter', () => {
    render(<CreditsTitleCard clock={new CreditsClock(60)} count={1} accent="#f59e0b" />);
    expect(screen.getByText(/madePossibleBy/, { selector: '.sr-only' })).toHaveTextContent(
      'supporters.credits.people.one'
    );
  });

  it('types the first line out as the playhead moves, and back again on a rewind', () => {
    const clock = new CreditsClock(60);
    const { container } = render(<CreditsTitleCard clock={clock} count={2} accent="#000" />);
    const typed = () =>
      [...container.querySelectorAll('[aria-hidden="true"] span > span:first-child')].map(
        (s) => s.textContent
      )[0];
    expect(typed()).toBe('');
    act(() => clock.seek(0.5 + 10 / 22));
    expect(typed()).toBe(LINE_1.slice(0, 10));
    act(() => clock.seek(0));
    expect(typed()).toBe('');
  });

  it('is gone once the roll starts', () => {
    const clock = new CreditsClock(60);
    const { container } = render(<CreditsTitleCard clock={clock} count={2} accent="#000" />);
    act(() => clock.seek(INTRO_SECONDS));
    expect((container.firstChild as HTMLElement).style.visibility).toBe('hidden');
  });
});
