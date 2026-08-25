import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
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

describe('CompartmentTextInput multiline', () => {
  it('is a single-line field unless multiline is asked for', () => {
    render(
      <CompartmentTextInput
        committedValue=""
        compartmentId={0}
        placeholder="p"
        ariaLabel="caption"
        onCommit={vi.fn()}
      />
    );
    expect(screen.getByRole('textbox', { name: 'caption' }).tagName).toBe('INPUT');
  });

  it('accepts line breaks when asked, which is the only way to reach a subheading', () => {
    render(
      <CompartmentTextInput
        multiline
        committedValue=""
        compartmentId={0}
        placeholder="p"
        ariaLabel="caption"
        onCommit={vi.fn()}
      />
    );
    const field = screen.getByRole('textbox', { name: 'caption' });
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'M3 HEX NUTS\nDIN 934' } });
    expect((field as HTMLTextAreaElement).value).toBe('M3 HEX NUTS\nDIN 934');
  });

  it('swallows Enter at the line cap rather than letting the tail be truncated later', () => {
    render(
      <CompartmentTextInput
        multiline
        committedValue={'a\nb\nc'}
        compartmentId={0}
        placeholder="p"
        ariaLabel="caption"
        onCommit={vi.fn()}
      />
    );
    const field = screen.getByRole('textbox', { name: 'caption' });
    const event = createEvent.keyDown(field, { key: 'Enter' });
    fireEvent(field, event);
    expect(event.defaultPrevented).toBe(true);
  });

  describe('inside a list, where Enter already means the next row', () => {
    function listRow(committedValue = '') {
      const onNavigate = vi.fn();
      const onCommit = vi.fn();
      render(
        <CompartmentTextInput
          multiline
          minRows={1}
          committedValue={committedValue}
          compartmentId={0}
          placeholder="p"
          ariaLabel="caption"
          onCommit={onCommit}
          onNavigate={onNavigate}
        />
      );
      const field: HTMLTextAreaElement = screen.getByRole('textbox', { name: 'caption' });
      return { field, onNavigate, onCommit };
    }

    it('keeps Enter moving to the next row rather than breaking the line', () => {
      const { field, onNavigate } = listRow('5/16 x 3-1/4');
      const event = createEvent.keyDown(field, { key: 'Enter' });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('next');
    });

    it('gives the line break to Shift+Enter instead', () => {
      const { field, onNavigate } = listRow('5/16 x 3-1/4');
      const event = createEvent.keyDown(field, { key: 'Enter', shiftKey: true });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('still swallows Shift+Enter at the line cap', () => {
      const { field } = listRow('a\nb\nc');
      const event = createEvent.keyDown(field, { key: 'Enter', shiftKey: true });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('leaves the row when the caret has no line to move onto', () => {
      const { field, onNavigate } = listRow('Grade 8');
      field.setSelectionRange(3, 3);
      const event = createEvent.keyDown(field, { key: 'ArrowDown' });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('next');
    });

    it('walks the caret instead when the caption has a line below', () => {
      const { field, onNavigate } = listRow('5/16 x 3-1/4\nGrade 8');
      field.setSelectionRange(3, 3);
      const event = createEvent.keyDown(field, { key: 'ArrowDown' });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('walks the caret up when the caption has a line above', () => {
      const { field, onNavigate } = listRow('5/16 x 3-1/4\nGrade 8');
      field.setSelectionRange(15, 15);
      const event = createEvent.keyDown(field, { key: 'ArrowUp' });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  it('leaves Enter breaking the line in a standalone field, which has no rows', () => {
    render(
      <CompartmentTextInput
        multiline
        committedValue="Heading"
        compartmentId={0}
        placeholder="p"
        ariaLabel="caption"
        onCommit={vi.fn()}
      />
    );
    const field = screen.getByRole('textbox', { name: 'caption' });
    const event = createEvent.keyDown(field, { key: 'Enter' });
    fireEvent(field, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('normalises a paste on the way in, so the field shows what will be stored', () => {
    render(
      <CompartmentTextInput
        multiline
        committedValue=""
        compartmentId={0}
        placeholder="p"
        ariaLabel="caption"
        onCommit={vi.fn()}
      />
    );
    const field = screen.getByRole('textbox', { name: 'caption' });
    fireEvent.change(field, { target: { value: 'a\r\nb\r\nc\r\nd\r\ne' } });
    expect((field as HTMLTextAreaElement).value).toBe('a\nb\nc');
  });
});
