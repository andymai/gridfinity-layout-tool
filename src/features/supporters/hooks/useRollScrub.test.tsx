import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreditsClock } from '../utils/creditsClock';
import { buildRollTimeline } from '../utils/rollTimeline';
import { HOLD_RATE, NO_SCRUB_ATTR, useRollScrub } from './useRollScrub';

const timeline = buildRollTimeline({
  startOffset: -600,
  endOffset: 3400,
  baseSpeed: 100,
  introSeconds: 5,
  marks: [],
});

function Harness({
  clock,
  onTogglePause = () => {},
  onSkip = () => {},
  onCredit = () => {},
}: {
  clock: CreditsClock;
  onTogglePause?: () => void;
  onSkip?: () => void;
  onCredit?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useRollScrub({
    enabled: true,
    target: ref,
    clock,
    timeline,
    baseSpeed: 100,
    onTogglePause,
    onSkip,
  });
  return (
    <div ref={ref} data-testid="stage">
      <button type="button" onClick={onCredit}>
        Ada
      </button>
      <form {...{ [NO_SCRUB_ATTR]: '' }}>
        <input aria-label="find" />
      </form>
    </div>
  );
}

const makeClock = () => {
  const clock = new CreditsClock(timeline.duration);
  clock.seek(timeline.timeAt(1000));
  return clock;
};

describe('useRollScrub', () => {
  it('scrubs by the distance wheeled', () => {
    const clock = makeClock();
    render(<Harness clock={clock} />);
    fireEvent.wheel(screen.getByTestId('stage'), { deltaY: 300 });
    expect(timeline.offsetAt(clock.time)).toBeCloseTo(1300, 0);
  });

  it('leaves the wheel alone inside the search form', () => {
    const clock = makeClock();
    const before = clock.time;
    render(<Harness clock={clock} />);
    fireEvent.wheel(screen.getByLabelText('find'), { deltaY: 300 });
    expect(clock.time).toBe(before);
  });

  it('fast-forwards and rewinds while an arrow key is held', () => {
    const clock = makeClock();
    render(<Harness clock={clock} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(clock.targetRate).toBe(HOLD_RATE);
    fireEvent.keyUp(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(clock.targetRate).toBe(-HOLD_RATE);
    fireEvent.keyUp(window, { key: 'ArrowUp' });
    expect(clock.targetRate).toBe(1);
  });

  it('toggles pause once for a held Space, not on every repeat', () => {
    const onTogglePause = vi.fn();
    render(<Harness clock={makeClock()} onTogglePause={onTogglePause} />);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ', repeat: true });
    fireEvent.keyDown(window, { key: ' ', repeat: true });
    expect(onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('lets go of a held arrow when the window loses focus', () => {
    const clock = makeClock();
    render(<Harness clock={clock} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.blur(window);
    expect(clock.targetRate).toBe(1);
  });

  it('ignores a drag that starts inside a no-scrub region', () => {
    const clock = makeClock();
    const before = clock.time;
    render(<Harness clock={clock} />);
    const field = screen.getByLabelText('find');
    fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientY: 400 });
    fireEvent.pointerMove(field, { pointerId: 1, clientY: 200 });
    expect(clock.time).toBe(before);
  });

  it('pauses on Space and skips on End', () => {
    const onTogglePause = vi.fn();
    const onSkip = vi.fn();
    render(<Harness clock={makeClock()} onTogglePause={onTogglePause} onSkip={onSkip} />);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'End' });
    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('drags the roll, holding it still, and does not click the credit it ends on', () => {
    const clock = makeClock();
    const onCredit = vi.fn();
    render(<Harness clock={clock} onCredit={onCredit} />);
    const credit = screen.getByRole('button', { name: 'Ada' });
    fireEvent.pointerDown(credit, { button: 0, pointerId: 1, clientY: 400 });
    fireEvent.pointerMove(credit, { pointerId: 1, clientY: 390 });
    expect(clock.targetRate).toBe(0);
    fireEvent.pointerMove(credit, { pointerId: 1, clientY: 200 });
    fireEvent.pointerUp(credit, { pointerId: 1, clientY: 200 });
    fireEvent.click(credit);
    expect(timeline.offsetAt(clock.time)).toBeCloseTo(1200, 0);
    expect(onCredit).not.toHaveBeenCalled();
    expect(clock.targetRate).toBe(1);
  });

  it('still clicks a credit that was only tapped', () => {
    const onCredit = vi.fn();
    render(<Harness clock={makeClock()} onCredit={onCredit} />);
    const credit = screen.getByRole('button', { name: 'Ada' });
    fireEvent.pointerDown(credit, { button: 0, pointerId: 1, clientY: 400 });
    fireEvent.pointerUp(credit, { pointerId: 1, clientY: 401 });
    fireEvent.click(credit);
    expect(onCredit).toHaveBeenCalledTimes(1);
  });
});
