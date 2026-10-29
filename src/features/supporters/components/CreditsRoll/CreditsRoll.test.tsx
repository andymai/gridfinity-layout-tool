import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CreditsRoll } from './CreditsRoll';
import { CreditsClock } from '../../utils/creditsClock';
import { buildCreditsPlan } from '../../utils/creditsPlan';
import type { RollSchedule } from '../../utils/rollSchedule';
import type { SupporterBin } from '../../utils/supportersData';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const bins: SupporterBin[] = [
  { id: 'a', name: 'Ada', department: 0, isNewest: false },
  { id: 'b', name: 'Bo', department: 0, isNewest: true },
  { id: 'q', name: 'Quinn', department: 2, message: 'Saved my garage', isNewest: false },
  { id: 's1', name: 'Somebody', department: 0, isNewest: false },
  { id: 's2', name: 'Somebody', department: 2, isNewest: false },
  { id: 'x', name: null, isNewest: false },
];
const plan = buildCreditsPlan(bins);
const binsById = new Map(bins.map((b) => [b.id, b]));
const order = plan.items.map((i) => i.id);

const props = (over: Partial<React.ComponentProps<typeof CreditsRoll>> = {}) => ({
  plan,
  binsById,
  clock: new CreditsClock(0),
  mode: 'roll' as const,
  stacked: false,
  baseSpeed: 100,
  accent: '#f59e0b',
  hidden: false,
  focusedId: null,
  onSchedule: vi.fn(),
  onCredit: vi.fn(),
  onKeyboardFocus: vi.fn(),
  ...over,
});

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    const id = this.dataset.creditId;
    return id ? order.indexOf(id) * 50 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
});

afterEach(() => vi.restoreAllMocks());

describe('CreditsRoll', () => {
  it('rolls the departments in order, with the redacted one last', () => {
    render(<CreditsRoll {...props()} />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'supporters.credits.dept.oneMoreBin',
      'supporters.credits.dept.magnetHoles',
      'supporters.credits.somebody.title',
      'supporters.credits.dept.redacted',
    ]);
    expect(screen.getByText('supporters.credits.dept.magnetHolesNote')).toBeInTheDocument();
  });

  it('credits an anonymous supporter as a redaction bar that reads as Anonymous', () => {
    render(<CreditsRoll {...props()} />);
    expect(screen.getByRole('button', { name: 'supporters.anonymous' })).toBeInTheDocument();
  });

  it('credits everyone named Somebody on one line that reads its count aloud', () => {
    render(<CreditsRoll {...props()} />);
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByText('supporters.credits.somebody.crowdLabel')).toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: 'Somebody' })).not.toBeInTheDocument();
  });

  it('puts a quote on its own line beside the name', () => {
    render(<CreditsRoll {...props()} />);
    const quote = screen.getByText('Saved my garage');
    expect(quote.tagName).toBe('Q');
    expect(screen.getByRole('button', { name: 'Quinn' })).toBeInTheDocument();
  });

  it('tags the newest supporter', () => {
    render(<CreditsRoll {...props()} />);
    expect(screen.getByRole('button', { name: 'Bo' })).toHaveTextContent('supporters.justJoined');
  });

  it('keeps hidden credits readable but out of the tab order', () => {
    render(<CreditsRoll {...props({ hidden: true })} />);
    const credit = screen.getByRole('button', { name: 'Ada' });
    expect(credit).toHaveAttribute('tabindex', '-1');
  });

  it('stops on a credit reached from the keyboard and undoes the focus scroll', () => {
    const onKeyboardFocus = vi.fn();
    const { container } = render(<CreditsRoll {...props({ onKeyboardFocus })} />);
    const region = container.querySelector('section');
    if (!region) throw new Error('no region');
    region.scrollTop = 120;
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.focus(screen.getByRole('button', { name: 'Ada' }));
    expect(onKeyboardFocus).toHaveBeenCalledWith('a');
    expect(region.scrollTop).toBe(0);
  });

  it('leaves a credit focused by the pointer to its click', () => {
    const onKeyboardFocus = vi.fn();
    render(<CreditsRoll {...props({ onKeyboardFocus })} />);
    const credit = screen.getByRole('button', { name: 'Ada' });
    fireEvent.pointerDown(credit);
    fireEvent.focus(credit);
    expect(onKeyboardFocus).not.toHaveBeenCalled();
  });

  it('reports a click on a credit', () => {
    const onCredit = vi.fn();
    render(<CreditsRoll {...props({ onCredit })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ada' }));
    expect(onCredit).toHaveBeenCalledWith('a');
  });

  it('measures itself into a schedule that seats every bin', () => {
    const onSchedule = vi.fn<(s: RollSchedule | null) => void>();
    render(<CreditsRoll {...props({ onSchedule })} />);
    const schedule = onSchedule.mock.lastCall?.[0];
    expect([...(schedule?.seatTimes.keys() ?? [])].sort()).toEqual([
      'a',
      'b',
      'q',
      's1',
      's2',
      'x',
    ]);
  });

  it('slides with the clock', () => {
    const clock = new CreditsClock(0);
    const seen: { schedule: RollSchedule | null } = { schedule: null };
    const { container } = render(
      <CreditsRoll {...props({ clock, onSchedule: (s) => (seen.schedule = s) })} />
    );
    clock.setDuration(seen.schedule?.timeline.duration ?? 0);
    act(() => clock.seek(clock.duration));
    const list = container.querySelector<HTMLElement>('.will-change-transform');
    expect(list?.style.transform).toBe(
      `translate3d(0, ${-(seen.schedule?.timeline.endOffset ?? 0)}px, 0)`
    );
  });

  it('stays put and skips the schedule when motion is reduced', () => {
    const onSchedule = vi.fn();
    const clock = new CreditsClock(100);
    const { container } = render(<CreditsRoll {...props({ clock, mode: 'scroll', onSchedule })} />);
    clock.seek(50);
    expect(onSchedule).toHaveBeenCalledWith(null);
    expect(container.querySelector<HTMLElement>('.will-change-transform')?.style.transform).toBe(
      ''
    );
  });
});
