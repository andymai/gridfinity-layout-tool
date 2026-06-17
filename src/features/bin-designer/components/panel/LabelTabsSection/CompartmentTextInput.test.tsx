import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompartmentTextInput } from './CompartmentTextInput';

const COMMIT_IDLE_MS = 450;

describe('CompartmentTextInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const COMPARTMENT_ID = 2;

  function setup(committedValue = '') {
    const onCommit = vi.fn();
    const utils = render(
      <CompartmentTextInput
        committedValue={committedValue}
        compartmentId={COMPARTMENT_ID}
        placeholder="text"
        ariaLabel="Engraved text"
        onCommit={onCommit}
      />
    );
    const input = screen.getByLabelText('Engraved text');
    return { ...utils, input, onCommit };
  }

  it('does not commit while typing — only after the idle delay', () => {
    const { input, onCommit } = setup();
    fireEvent.change(input, { target: { value: 'S' } });
    fireEvent.change(input, { target: { value: 'SC' } });
    fireEvent.change(input, { target: { value: 'SCR' } });
    // Mid-word keystrokes must not have committed.
    expect(onCommit).not.toHaveBeenCalled();
    // The displayed value tracks the draft immediately, though.
    expect(input).toHaveValue('SCR');

    vi.advanceTimersByTime(COMMIT_IDLE_MS);
    // One commit for the whole burst, with the final value + compartment id.
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(COMPARTMENT_ID, 'SCR');
  });

  it('commits immediately on blur and cancels the pending idle timer', () => {
    const { input, onCommit } = setup();
    fireEvent.change(input, { target: { value: 'BOLTS' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(COMPARTMENT_ID, 'BOLTS');
    // The idle timer that was pending must not fire a second commit.
    vi.advanceTimersByTime(COMMIT_IDLE_MS);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('re-syncs the draft when the committed value changes externally (while blurred)', () => {
    const { input, rerender, onCommit } = setup('OLD');
    expect(input).toHaveValue('OLD');
    // Simulate undo/redo/load updating the committed value from outside.
    rerender(
      <CompartmentTextInput
        committedValue="NEW"
        compartmentId={COMPARTMENT_ID}
        placeholder="text"
        ariaLabel="Engraved text"
        onCommit={onCommit}
      />
    );
    expect(input).toHaveValue('NEW');
  });

  it('does not clobber an in-progress draft when focused', () => {
    const { input, rerender, onCommit } = setup('OLD');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'TYPING' } });
    // An external committed-value change arrives mid-typing (focus guard).
    rerender(
      <CompartmentTextInput
        committedValue="EXTERNAL"
        compartmentId={COMPARTMENT_ID}
        placeholder="text"
        ariaLabel="Engraved text"
        onCommit={onCommit}
      />
    );
    // The user's in-progress draft survives.
    expect(input).toHaveValue('TYPING');
  });
});
