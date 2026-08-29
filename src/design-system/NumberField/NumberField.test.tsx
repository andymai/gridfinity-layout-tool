import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from './NumberField';

const field = (): HTMLInputElement => screen.getByRole('spinbutton');

describe('NumberField', () => {
  it('renders without crashing', () => {
    render(<NumberField label="X" value={10} onChange={vi.fn()} />);

    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<NumberField label="W" value={25.5} onChange={vi.fn()} />);

    expect(field()).toHaveValue('25.5');
  });

  it('formats integer values without decimal', () => {
    render(<NumberField label="X" value={10} onChange={vi.fn()} />);

    expect(field()).toHaveValue('10');
  });

  it('displays the unit when provided', () => {
    render(<NumberField label="R" value={90} onChange={vi.fn()} unit="°" />);

    expect(screen.getByText('°')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<NumberField label="X" value={10} onChange={vi.fn()} disabled />);

    expect(field()).toBeDisabled();
  });

  it('selects the value for exact entry on focus', async () => {
    const user = userEvent.setup();
    render(<NumberField label="X" value={10} onChange={vi.fn()} />);

    await user.click(field());

    expect(field()).toHaveFocus();
    expect(field()).toHaveValue('10');
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe(2);
  });

  it('commits value on Enter key', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: '25' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(25);
    expect(field()).not.toHaveFocus();
  });

  it('cancels edit on Escape key', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: '25' } });
    fireEvent.keyDown(field(), { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue('10');
  });

  it('commits value on blur', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: '30' } });
    fireEvent.blur(field());

    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('increments value with ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    await user.click(field());
    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('decrements value with ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    await user.click(field());
    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(9);
  });

  it('increments by 10x with Shift+ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    await user.click(field());
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('decrements by 10x with Shift+ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={20} onChange={onChange} step={1} />);

    await user.click(field());
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');

    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('clamps value to min', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} min={5} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: '2' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('clamps value to max', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} max={15} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(15);
  });

  describe('expressions', () => {
    it('evaluates typed arithmetic on commit', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '42/2' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(21);
    });

    it('tolerates a typed unit suffix', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '42mm' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(42);
    });

    it('nudges from an evaluated expression, not the committed value', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} step={1} max={100} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '42/2' } });
      fireEvent.keyDown(field(), { key: 'ArrowUp' });

      expect(onChange).toHaveBeenLastCalledWith(22);
    });

    it('reverts a typed division by zero instead of committing Infinity', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} softMax />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '5/0' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('falls back to plain parsing when expression is off', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} expression={false} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '42/2' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      // parseFloat("42/2") is 42 — trailing garbage tolerated, no arithmetic.
      expect(onChange).toHaveBeenCalledWith(42);
    });
  });

  describe('softMax', () => {
    it('commits a typed value past max instead of truncating it', () => {
      const onChange = vi.fn();
      render(<NumberField label="W" value={10} onChange={onChange} max={123.1} softMax />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '156' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(156);
    });

    it('still enforces min on a typed value', () => {
      const onChange = vi.fn();
      render(<NumberField label="W" value={10} onChange={onChange} min={2} softMax />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '-5' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('still caps arrow keys at max while the value is under it', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NumberField label="W" value={15} onChange={onChange} max={15} step={1} softMax />);

      await user.click(field());
      await user.keyboard('{ArrowUp}');

      expect(onChange).toHaveBeenCalledWith(15);
    });

    it('steps down from an over-max value rather than snapping back to max', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <NumberField label="W" value={156} onChange={onChange} max={123.1} step={1} softMax />
      );

      await user.click(field());
      await user.keyboard('{ArrowDown}');

      expect(onChange).toHaveBeenCalledWith(155);
    });

    it('can nudge an over-max value back up after stepping it down', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      // Re-render with the new value, as the real parent does — a ceiling
      // pinned to `value` would ratchet down and strand ArrowUp at 155.
      const { rerender } = render(
        <NumberField label="W" value={156} onChange={onChange} max={123.1} step={1} softMax />
      );
      await user.click(field());
      await user.keyboard('{ArrowDown}');
      expect(onChange).toHaveBeenLastCalledWith(155);

      rerender(
        <NumberField label="W" value={155} onChange={onChange} max={123.1} step={1} softMax />
      );
      await user.keyboard('{ArrowUp}');
      expect(onChange).toHaveBeenLastCalledWith(156);
    });

    // A hard `max` used to absorb these; softMax has no ceiling to absorb them,
    // and a non-finite dimension would poison bounds and geometry downstream.
    it.each(['Infinity', '-Infinity', '1e309'])('rejects %s instead of committing it', (raw) => {
      const onChange = vi.fn();
      render(<NumberField label="W" value={10} onChange={onChange} min={2} softMax />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: raw } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    // The guard is app-wide on purpose: a hard-max field used to commit the
    // ceiling for "Infinity" while leaving "abc" alone. Both revert now.
    it('rejects a non-finite entry on a hard-max field too', () => {
      const onChange = vi.fn();
      render(<NumberField label="R" value={10} onChange={onChange} max={359} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '1e309' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    // Overflow is typed-only: a nudge may not push a value further past the
    // ceiling than the number the user actually entered.
    it('will not nudge an over-max value any higher', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <NumberField label="W" value={156} onChange={onChange} max={123.1} step={1} softMax />
      );

      await user.click(field());
      await user.keyboard('{ArrowUp}');

      expect(onChange).toHaveBeenLastCalledWith(156);
    });

    // Arrows used to nudge from the last committed value, so a typed-then-nudged
    // entry was discarded — the same truncation softMax exists to remove.
    it('nudges from a typed but uncommitted value, not the committed one', () => {
      const onChange = vi.fn();
      render(<NumberField label="W" value={10} onChange={onChange} max={123.1} step={1} softMax />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '156' } });
      fireEvent.keyDown(field(), { key: 'ArrowDown' });

      expect(onChange).toHaveBeenLastCalledWith(155);
    });

    it('re-derives the nudge ceiling when a smaller value is typed over an over-max one', () => {
      const onChange = vi.fn();
      render(
        <NumberField label="W" value={156} onChange={onChange} max={123.1} step={1} softMax />
      );

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '100' } });
      for (let i = 0; i < 5; i++) fireEvent.keyDown(field(), { key: 'ArrowUp' });

      // 100 + 5 would be 105; the point is it may not climb toward the old 156.
      expect(onChange.mock.calls.every(([v]) => v <= 123.1)).toBe(true);
    });

    it('keeps a large finite entry legible instead of rendering it as Infinity', () => {
      const onChange = vi.fn();
      const { rerender } = render(<NumberField label="W" value={10} onChange={onChange} softMax />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '1e307' } });
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(onChange).toHaveBeenLastCalledWith(1e307);

      // The precision scale-up overflows here, so an unguarded round would
      // display "Infinity" — a string that no longer parses back to a
      // committable value.
      rerender(<NumberField label="W" value={1e307} onChange={onChange} softMax />);
      expect(field()).not.toHaveValue('Infinity');
    });

    it('reports a valid ARIA range while the value sits past max', () => {
      render(<NumberField label="W" value={156} onChange={vi.fn()} max={123.1} softMax />);
      const spin = screen.getByRole('spinbutton', { name: 'W' });
      expect(spin).toHaveAttribute('aria-valuenow', '156');
      expect(spin).toHaveAttribute('aria-valuemax', '156');
    });

    it('still reports the prop max while the value is inside the range', () => {
      render(<NumberField label="W" value={40} onChange={vi.fn()} max={123.1} softMax />);
      expect(screen.getByRole('spinbutton', { name: 'W' })).toHaveAttribute(
        'aria-valuemax',
        '123.1'
      );
    });

    it('leaves the default (hard max) behaviour untouched', () => {
      const onChange = vi.fn();
      render(<NumberField label="W" value={10} onChange={onChange} max={123.1} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '156' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(123.1);
    });
  });

  // A `max` can drop below the value it governs — an oversize cutout pins its
  // X ceiling to 0 while X still holds its stored offset. Focusing such a field
  // and leaving must not rewrite what the user is looking at.
  describe('when max has fallen below the value', () => {
    it('does not destroy the value on focus and blur', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={20} onChange={onChange} min={0} max={0} />);

      fireEvent.focus(field());
      fireEvent.blur(field());

      // No write at all: the value stays 20 because nothing changed.
      expect(onChange).not.toHaveBeenCalled();
    });

    it('still refuses a typed value above it', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={20} onChange={onChange} min={0} max={0} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '50' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      // 50 clamps back to the held 20, so there is no change to write.
      expect(onChange).not.toHaveBeenCalled();
    });

    it('lets an arrow key move the value back toward range', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<NumberField label="X" value={20} onChange={onChange} min={0} max={0} step={0.5} />);

      await user.click(field());
      await user.keyboard('{ArrowDown}');

      expect(onChange).toHaveBeenLastCalledWith(19.5);
    });
  });

  // Only `softMax` may let typed text raise the nudge ceiling. Without the
  // distinction a hard-max field can be walked past its own limit: type 500
  // into a max-359 field, then arrow, and the nudge clamps to 500 not 359.
  it('does not let a typed over-max entry raise the nudge ceiling on a hard-max field', () => {
    const onChange = vi.fn();
    render(<NumberField label="R" value={10} onChange={onChange} min={0} max={359} step={1} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: '500' } });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });

    expect(onChange).toHaveBeenLastCalledWith(359);
  });

  it('binds a max that drops while the field is open', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumberField label="R" value={200} onChange={onChange} min={0} max={359} step={1} />
    );
    fireEvent.focus(field());

    // The ceiling is derived from live props, not captured on entry.
    rerender(<NumberField label="R" value={200} onChange={onChange} min={0} max={100} step={1} />);
    fireEvent.keyDown(field(), { key: 'ArrowUp' });

    expect(onChange).toHaveBeenLastCalledWith(200);
  });

  it('prevents decrement below min with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={5} onChange={onChange} min={5} step={1} />);

    await user.click(field());
    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('prevents increment above max with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={15} onChange={onChange} max={15} step={1} />);

    await user.click(field());
    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('ignores invalid input', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} />);

    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'abc' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue('10');
  });

  it('applies a fine step with Alt+ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    await user.click(field());
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');

    expect(onChange).toHaveBeenCalledWith(10.1);
  });

  it('exposes spinbutton semantics on the input', () => {
    render(<NumberField label="X" value={10} onChange={vi.fn()} min={0} max={50} />);
    const spin = screen.getByRole('spinbutton', { name: 'X' });
    expect(spin).toHaveAttribute('aria-valuenow', '10');
    expect(spin).toHaveAttribute('aria-valuemax', '50');
  });

  it('scrubs the value when dragging the label horizontally', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    const handle = screen.getByText('X');
    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerMove(document, { clientX: 118 }); // +18px → 3 steps
    expect(onChange).toHaveBeenLastCalledWith(13);
    fireEvent.pointerUp(document);
  });

  it('does not focus the input after a scrub drag', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    const handle = screen.getByText('X');
    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerMove(document, { clientX: 130 });
    fireEvent.pointerUp(document);

    expect(field()).not.toHaveFocus();
  });

  it('focuses the input for typing on a label click without movement', () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value={10} onChange={onChange} step={1} />);

    const handle = screen.getByText('X');
    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerUp(document);

    expect(field()).toHaveFocus();
  });

  // A blur or Enter that leaves the committed value unchanged must not write to
  // the store. In the bin designer each write churns cutout references, spends an
  // undo slot, and re-renders — which lets the focus/select effect steal focus,
  // blur a neighbour, and commit again, driving the "Maximum update depth
  // exceeded" render loop.
  describe('no-op writes', () => {
    it('does not write on focus and blur when nothing was typed', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} />);

      fireEvent.focus(field());
      fireEvent.blur(field());

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not write when a typed value clamps back to the current value', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={15} onChange={onChange} max={15} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '20' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not write when the same value is retyped', () => {
      const onChange = vi.fn();
      render(<NumberField label="X" value={10} onChange={onChange} />);

      fireEvent.focus(field());
      fireEvent.change(field(), { target: { value: '10' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the typed-entry ceiling fixed while the field is open', () => {
      // `value` jumps above max mid-edit, as a store write could push it. The
      // typed-entry ceiling must stay at max, not follow the value up, or a
      // clamp could chase its own value past the limit and loop.
      const onChange = vi.fn();
      const { rerender } = render(
        <NumberField label="X" value={10} onChange={onChange} min={0} max={20} />
      );
      fireEvent.focus(field());
      rerender(<NumberField label="X" value={50} onChange={onChange} min={0} max={20} />);

      fireEvent.change(field(), { target: { value: '45' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(onChange).toHaveBeenLastCalledWith(20);
    });
  });

  it('shows a mixed placeholder when indeterminate, not the value', () => {
    render(<NumberField label="R" value={42} onChange={vi.fn()} indeterminate />);
    expect(field()).toHaveValue('–');
    expect(screen.getByRole('spinbutton', { name: 'R' })).toHaveAttribute(
      'aria-valuetext',
      'mixed'
    );
  });

  it('opens an empty editor from the mixed state so a typed value unifies all', () => {
    render(<NumberField label="R" value={42} onChange={vi.fn()} indeterminate />);
    fireEvent.focus(field());
    expect(field()).toHaveValue('');
  });

  it('applies the compact height at size sm', () => {
    const { container } = render(<NumberField label="X" value={10} onChange={vi.fn()} size="sm" />);
    expect(container.firstElementChild?.className).toContain('h-(--control-h-sm)');
  });

  it('rounds display to the given precision', () => {
    render(<NumberField label="X" value={1.2345} onChange={vi.fn()} precision={3} />);
    expect(field()).toHaveValue('1.235');
  });
});
