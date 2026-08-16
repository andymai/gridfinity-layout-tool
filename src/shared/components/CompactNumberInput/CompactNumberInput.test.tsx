import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompactNumberInput } from './CompactNumberInput';

describe('CompactNumberInput', () => {
  it('renders without crashing', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<CompactNumberInput label="W" value={25.5} onChange={vi.fn()} />);

    expect(screen.getByText('25.5')).toBeInTheDocument();
  });

  it('formats integer values without decimal', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('displays the unit when provided', () => {
    render(<CompactNumberInput label="R" value={90} onChange={vi.fn()} unit="°" />);

    expect(screen.getByText('°')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not enter edit mode when disabled', async () => {
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} disabled />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('enters edit mode on click', async () => {
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('10');
    expect(input).toHaveFocus();
  });

  it('commits value on Enter key', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change the value directly
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(25);
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('cancels edit on Escape key', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('commits value on blur', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('increments value with ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('decrements value with ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(9);
  });

  it('increments by 10x with Shift+ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('decrements by 10x with Shift+ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={20} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');

    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('clamps value to min', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} min={5} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('clamps value to max', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} max={15} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(15);
  });

  describe('softMax', () => {
    it('commits a typed value past max instead of truncating it', () => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="W" value={10} onChange={onChange} max={123.1} softMax />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '156' } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(156);
    });

    it('still enforces min on a typed value', () => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="W" value={10} onChange={onChange} min={2} softMax />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '-5' } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('still caps arrow keys at max while the value is under it', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <CompactNumberInput label="W" value={15} onChange={onChange} max={15} step={1} softMax />
      );

      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowUp}');

      expect(onChange).toHaveBeenCalledWith(15);
    });

    it('steps down from an over-max value rather than snapping back to max', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <CompactNumberInput
          label="W"
          value={156}
          onChange={onChange}
          max={123.1}
          step={1}
          softMax
        />
      );

      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}');

      expect(onChange).toHaveBeenCalledWith(155);
    });

    it('can nudge an over-max value back up after stepping it down', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      // Re-render with the new value, as the real parent does — a ceiling
      // pinned to `value` would ratchet down and strand ArrowUp at 155.
      const { rerender } = render(
        <CompactNumberInput
          label="W"
          value={156}
          onChange={onChange}
          max={123.1}
          step={1}
          softMax
        />
      );
      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}');
      expect(onChange).toHaveBeenLastCalledWith(155);

      rerender(
        <CompactNumberInput
          label="W"
          value={155}
          onChange={onChange}
          max={123.1}
          step={1}
          softMax
        />
      );
      await user.keyboard('{ArrowUp}');
      expect(onChange).toHaveBeenLastCalledWith(156);
    });

    // A hard `max` used to absorb these; softMax has no ceiling to absorb them,
    // and a non-finite dimension would poison bounds and geometry downstream.
    it.each(['Infinity', '-Infinity', '1e309'])('rejects %s instead of committing it', (raw) => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="W" value={10} onChange={onChange} min={2} softMax />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: raw } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    // The guard is app-wide on purpose: a hard-max field used to commit the
    // ceiling for "Infinity" while leaving "abc" alone. Both revert now.
    it('rejects a non-finite entry on a hard-max field too', () => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="R" value={10} onChange={onChange} max={359} />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '1e309' } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    // Overflow is typed-only: a nudge may not push a value further past the
    // ceiling than the number the user actually entered.
    it('will not nudge an over-max value any higher', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <CompactNumberInput
          label="W"
          value={156}
          onChange={onChange}
          max={123.1}
          step={1}
          softMax
        />
      );
      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowUp}');

      expect(onChange).toHaveBeenLastCalledWith(156);
    });

    // Arrows used to nudge from the last committed value, so a typed-then-nudged
    // entry was discarded — the same truncation this PR exists to remove.
    it('nudges from a typed but uncommitted value, not the committed one', () => {
      const onChange = vi.fn();
      render(
        <CompactNumberInput label="W" value={10} onChange={onChange} max={123.1} step={1} softMax />
      );

      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '156' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(onChange).toHaveBeenLastCalledWith(155);
    });

    it('re-derives the nudge ceiling when a smaller value is typed over an over-max one', () => {
      const onChange = vi.fn();
      render(
        <CompactNumberInput
          label="W"
          value={156}
          onChange={onChange}
          max={123.1}
          step={1}
          softMax
        />
      );

      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '100' } });
      for (let i = 0; i < 5; i++) fireEvent.keyDown(input, { key: 'ArrowUp' });

      // 100 + 5 would be 105; the point is it may not climb toward the old 156.
      expect(onChange.mock.calls.every(([v]) => v <= 123.1)).toBe(true);
    });

    it('keeps a large finite entry legible instead of rendering it as Infinity', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <CompactNumberInput label="W" value={10} onChange={onChange} softMax />
      );

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '1e307' } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
      expect(onChange).toHaveBeenLastCalledWith(1e307);

      // `v * 100` overflows here, so an unguarded round would display "Infinity"
      // — a string that no longer parses back to a committable value.
      rerender(<CompactNumberInput label="W" value={1e307} onChange={onChange} softMax />);
      expect(screen.queryByText('Infinity')).not.toBeInTheDocument();
    });

    it('reports a valid ARIA range while the value sits past max', () => {
      render(<CompactNumberInput label="W" value={156} onChange={vi.fn()} max={123.1} softMax />);
      const slider = screen.getByRole('slider', { name: 'W' });
      expect(slider).toHaveAttribute('aria-valuenow', '156');
      expect(slider).toHaveAttribute('aria-valuemax', '156');
    });

    it('still reports the prop max while the value is inside the range', () => {
      render(<CompactNumberInput label="W" value={40} onChange={vi.fn()} max={123.1} softMax />);
      expect(screen.getByRole('slider', { name: 'W' })).toHaveAttribute('aria-valuemax', '123.1');
    });

    it('leaves the default (hard max) behaviour untouched', () => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="W" value={10} onChange={onChange} max={123.1} />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '156' } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(123.1);
    });
  });

  // A `max` can drop below the value it governs — an oversize cutout pins its
  // X ceiling to 0 while X still holds its stored offset. Focusing such a field
  // and leaving must not rewrite what the user is looking at.
  describe('when max has fallen below the value', () => {
    it('does not destroy the value on focus and blur', () => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="X" value={20} onChange={onChange} min={0} max={0} />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.blur(screen.getByRole('textbox'));

      expect(onChange).toHaveBeenLastCalledWith(20);
    });

    it('still refuses a typed value above it', () => {
      const onChange = vi.fn();
      render(<CompactNumberInput label="X" value={20} onChange={onChange} min={0} max={0} />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(onChange).toHaveBeenLastCalledWith(20);
    });

    it('lets an arrow key move the value back toward range', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <CompactNumberInput label="X" value={20} onChange={onChange} min={0} max={0} step={0.5} />
      );

      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}');

      expect(onChange).toHaveBeenLastCalledWith(19.5);
    });
  });

  // Only `softMax` may let typed text raise the nudge ceiling. Without the
  // distinction a hard-max field can be walked past its own limit: type 500
  // into a max-359 field, then arrow, and the nudge clamps to 500 not 359.
  it('does not let a typed over-max entry raise the nudge ceiling on a hard-max field', () => {
    const onChange = vi.fn();
    render(
      <CompactNumberInput label="R" value={10} onChange={onChange} min={0} max={359} step={1} />
    );

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(onChange).toHaveBeenLastCalledWith(359);
  });

  it('binds a max that drops while the field is open', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CompactNumberInput label="R" value={200} onChange={onChange} min={0} max={359} step={1} />
    );
    fireEvent.click(screen.getByRole('button'));

    // The ceiling is derived from live props, not captured on entry.
    rerender(
      <CompactNumberInput label="R" value={200} onChange={onChange} min={0} max={100} step={1} />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowUp' });

    expect(onChange).toHaveBeenLastCalledWith(200);
  });

  it('prevents decrement below min with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={5} onChange={onChange} min={5} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('prevents increment above max with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={15} onChange={onChange} max={15} step={1} />);

    await user.click(screen.getByRole('button'));

    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('ignores invalid input', async () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');

    // Change to invalid text
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Component exits edit mode but doesn't call onChange with invalid value
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('applies a fine step with Alt+ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    await user.click(screen.getByRole('button'));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');

    expect(onChange).toHaveBeenCalledWith(10.1);
  });

  it('exposes a slider role on the draggable label', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} min={0} max={50} />);
    const slider = screen.getByRole('slider', { name: 'X' });
    expect(slider).toHaveAttribute('aria-valuenow', '10');
    expect(slider).toHaveAttribute('aria-valuemax', '50');
  });

  it('scrubs the value when dragging the label horizontally', () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    const slider = screen.getByRole('slider', { name: 'X' });
    fireEvent.pointerDown(slider, { clientX: 100 });
    fireEvent.pointerMove(document, { clientX: 118 }); // +18px → 3 steps
    expect(onChange).toHaveBeenLastCalledWith(13);
    fireEvent.pointerUp(document);
  });

  it('does not enter edit mode after a scrub drag', () => {
    const onChange = vi.fn();
    render(<CompactNumberInput label="X" value={10} onChange={onChange} step={1} />);

    const slider = screen.getByRole('slider', { name: 'X' });
    fireEvent.pointerDown(slider, { clientX: 100 });
    fireEvent.pointerMove(document, { clientX: 130 });
    fireEvent.pointerUp(document);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a mixed placeholder when indeterminate, not the value', () => {
    render(<CompactNumberInput label="R" value={42} onChange={vi.fn()} indeterminate />);
    expect(screen.getByRole('button', { name: 'R: mixed' })).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('opens an empty editor from the mixed state so a typed value unifies all', async () => {
    const user = userEvent.setup();
    render(<CompactNumberInput label="R" value={42} onChange={vi.fn()} indeterminate />);
    await user.click(screen.getByRole('button', { name: 'R: mixed' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
