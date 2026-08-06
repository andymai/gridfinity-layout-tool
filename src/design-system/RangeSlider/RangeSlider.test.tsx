import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RangeSlider } from './RangeSlider';

const STOPS = [1, 2, 3, 4, 5, 6];

function setup(overrides: Partial<React.ComponentProps<typeof RangeSlider>> = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <RangeSlider
      stops={STOPS}
      value={[2, 5]}
      onChange={onChange}
      onCommit={onCommit}
      lowerLabel="Minimum width"
      upperLabel="Maximum width"
      {...overrides}
    />
  );
  return {
    onChange,
    onCommit,
    lower: screen.getByLabelText('Minimum width'),
    upper: screen.getByLabelText('Maximum width'),
  };
}

describe('RangeSlider', () => {
  it('renders one slider per thumb', () => {
    setup();
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('bounds each thumb by the other so the two can never cross', () => {
    const { lower, upper } = setup();
    expect(lower).toHaveAttribute('aria-valuemin', '1');
    expect(lower).toHaveAttribute('aria-valuemax', '5');
    expect(upper).toHaveAttribute('aria-valuemin', '2');
    expect(upper).toHaveAttribute('aria-valuemax', '6');
  });

  it('moves the lower thumb with ArrowRight and commits the step', () => {
    const { lower, onChange, onCommit } = setup();
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([3, 5]);
    expect(onCommit).toHaveBeenCalledWith([3, 5]);
  });

  it('moves the upper thumb with ArrowLeft', () => {
    const { upper, onChange } = setup();
    fireEvent.keyDown(upper, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith([2, 4]);
  });

  it('stops the lower thumb at the upper one instead of crossing it', () => {
    const { lower, onChange } = setup({ value: [5, 5] });
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sends Home and End to the thumb-bounded ends, not the track ends', () => {
    const { lower, upper, onChange } = setup();
    fireEvent.keyDown(lower, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith([5, 5]);
    onChange.mockClear();
    fireEvent.keyDown(upper, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith([2, 2]);
  });

  it('snaps a value that is not on a stop to the nearest one', () => {
    const { lower } = setup({ stops: [1, 2, 4, 8], value: [5, 8] });
    expect(lower).toHaveAttribute('aria-valuenow', '4');
  });

  it('confines both thumbs to the selectable window', () => {
    const { lower, upper } = setup({ value: [1, 6], selectable: [2, 4] });
    expect(lower).toHaveAttribute('aria-valuenow', '2');
    expect(upper).toHaveAttribute('aria-valuenow', '4');
  });

  it('will not let the keyboard leave the selectable window', () => {
    const { upper, onChange } = setup({ value: [2, 4], selectable: [2, 4] });
    fireEvent.keyDown(upper, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks stops outside the selectable window as out of reach', () => {
    setup({ value: [2, 4], selectable: [2, 4] });
    expect(screen.getByTestId('range-slider-blocked-start')).toBeDefined();
    expect(screen.getByTestId('range-slider-blocked-end')).toBeDefined();
  });

  it('reports formatted values to screen readers', () => {
    const { lower } = setup({ formatValue: (v) => `${v} units` });
    expect(lower).toHaveAttribute('aria-valuetext', '2 units');
  });

  it('disables both thumbs when there is only one stop', () => {
    const { lower, upper } = setup({ stops: [3], value: [3, 3] });
    expect(lower).toBeDisabled();
    expect(upper).toBeDisabled();
  });

  it('keeps a complete ARIA value state when there are no stops yet', () => {
    const { lower, upper } = setup({ stops: [], value: [0, 0] });
    for (const thumb of [lower, upper]) {
      expect(thumb).toHaveAttribute('aria-valuenow', '0');
      expect(thumb).toHaveAttribute('aria-valuemin', '0');
      expect(thumb).toHaveAttribute('aria-valuemax', '0');
      expect(thumb).toBeDisabled();
    }
  });

  it('ignores keyboard input while disabled', () => {
    const { lower, onChange } = setup({ disabled: true });
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
