import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl, computeRowSizes } from './SegmentedControl';
import type { SegmentedControlProps } from './SegmentedControl';

type Mode = 'list' | 'grid' | 'table';

const defaultProps: SegmentedControlProps<Mode> = {
  options: [
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'table', label: 'Table' },
  ],
  value: 'list',
  onChange: () => {},
  'aria-label': 'View mode',
};

describe('SegmentedControl', () => {
  it('renders a radiogroup with the group label and one radio per option', () => {
    render(<SegmentedControl {...defaultProps} />);
    expect(screen.getByRole('radiogroup', { name: 'View mode' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'List' })).toBeInTheDocument();
  });

  it('marks only the selected option as checked', () => {
    render(<SegmentedControl {...defaultProps} value="grid" />);
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Table' })).toHaveAttribute('aria-checked', 'false');
  });

  it('gives the selected radio tabindex 0 and the rest -1', () => {
    render(<SegmentedControl {...defaultProps} value="grid" />);
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'Table' })).toHaveAttribute('tabindex', '-1');
  });

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('does not call onChange when clicking the already selected option', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'List' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects the next option on ArrowRight and ArrowDown', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} onChange={onChange} />);
    const selected = screen.getByRole('radio', { name: 'List' });
    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('grid');
    fireEvent.keyDown(selected, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('selects the previous option on ArrowLeft and ArrowUp, wrapping at the start', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'List' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('table');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'List' }), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('wraps to the first option when pressing ArrowRight on the last', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} value="table" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Table' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('selects the first option on Home and the last on End', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} value="grid" onChange={onChange} />);
    const selected = screen.getByRole('radio', { name: 'Grid' });
    fireEvent.keyDown(selected, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('list');
    fireEvent.keyDown(selected, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('prevents default on navigation keys but not on other keys', () => {
    render(<SegmentedControl {...defaultProps} />);
    const selected = screen.getByRole('radio', { name: 'List' });
    expect(fireEvent.keyDown(selected, { key: 'ArrowRight' })).toBe(false);
    expect(fireEvent.keyDown(selected, { key: 'Tab' })).toBe(true);
  });

  it('moves focus to the newly selected segment on arrow navigation', () => {
    render(<SegmentedControl {...defaultProps} />);
    const selected = screen.getByRole('radio', { name: 'List' });
    selected.focus();
    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveFocus();
  });

  it('skips disabled segments during arrow navigation', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        {...defaultProps}
        options={[
          { value: 'list', label: 'List' },
          { value: 'grid', label: 'Grid', disabled: true },
          { value: 'table', label: 'Table' },
        ]}
        onChange={onChange}
      />
    );
    fireEvent.keyDown(screen.getByRole('radio', { name: 'List' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('skips disabled segments for Home and End', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        {...defaultProps}
        options={[
          { value: 'list', label: 'List', disabled: true },
          { value: 'grid', label: 'Grid' },
          { value: 'table', label: 'Table', disabled: true },
        ]}
        value="grid"
        onChange={onChange}
      />
    );
    const selected = screen.getByRole('radio', { name: 'Grid' });
    fireEvent.keyDown(selected, { key: 'Home' });
    fireEvent.keyDown(selected, { key: 'End' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when clicking a disabled segment', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        {...defaultProps}
        options={[
          { value: 'list', label: 'List' },
          { value: 'grid', label: 'Grid', disabled: true },
        ]}
        onChange={onChange}
      />
    );
    const disabledRadio = screen.getByRole('radio', { name: 'Grid' });
    expect(disabledRadio).toBeDisabled();
    fireEvent.click(disabledRadio);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'List' }), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the subtle active pill classes by default', () => {
    render(<SegmentedControl {...defaultProps} />);
    const selected = screen.getByRole('radio', { name: 'List' });
    expect(selected.className).toContain('bg-surface-elevated');
    expect(selected.className).toContain('shadow-sm');
    expect(screen.getByRole('radio', { name: 'Grid' }).className).toContain(
      'text-content-tertiary'
    );
  });

  it('applies accent active classes when activeStyle is accent', () => {
    render(<SegmentedControl {...defaultProps} activeStyle="accent" />);
    const selected = screen.getByRole('radio', { name: 'List' });
    expect(selected.className).toContain('bg-accent');
    expect(selected.className).toContain('text-on-accent');
  });

  it('applies compact text size for size sm', () => {
    render(<SegmentedControl {...defaultProps} size="sm" />);
    expect(screen.getByRole('radio', { name: 'List' }).className).toContain('text-label');
  });

  it('stretches segments equally when fullWidth', () => {
    render(<SegmentedControl {...defaultProps} fullWidth />);
    expect(screen.getByRole('radiogroup').className).toContain('w-full');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toContain('flex-1');
    }
  });

  it('keeps the flex-wrap baseline before any overflow is measured', () => {
    render(<SegmentedControl {...defaultProps} />);
    expect(screen.getByRole('radiogroup').className).toContain('flex-wrap');
  });

  it('applies className to the group container', () => {
    render(<SegmentedControl {...defaultProps} className="custom-class" />);
    expect(screen.getByRole('radiogroup')).toHaveClass('custom-class');
  });

  it('hides the measurement probe from assistive tech and ancestor scroll extent', () => {
    render(<SegmentedControl {...defaultProps} />);
    const probe = screen.getByRole('radiogroup').querySelector('[data-measure]');
    expect(probe).not.toBeNull();
    const wrapper = probe?.closest('[aria-hidden="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('overflow-hidden');
    expect(wrapper?.className).toContain('w-0');
  });

  it('uses per-option aria-label and title for icon-only segments', () => {
    render(
      <SegmentedControl
        {...defaultProps}
        options={[
          {
            value: 'list',
            label: <svg aria-hidden="true" />,
            'aria-label': 'List view',
            title: 'List view',
          },
          {
            value: 'grid',
            label: <svg aria-hidden="true" />,
            'aria-label': 'Grid view',
            title: 'Grid view',
          },
        ]}
      />
    );
    expect(screen.getByRole('radio', { name: 'List view' })).toHaveAttribute('title', 'List view');
    expect(screen.getByRole('radio', { name: 'Grid view' })).toBeInTheDocument();
  });
});

function stubWidths(
  element: Element | null,
  widths: { offsetWidth?: number; clientWidth?: number }
): void {
  if (!element) throw new Error('expected an element to stub');
  for (const [property, width] of Object.entries(widths)) {
    Object.defineProperty(element, property, { get: () => width, configurable: true });
  }
}

describe('SegmentedControl grid collapse', () => {
  function renderOverflowing(onChange: (value: Mode) => void = () => {}): HTMLElement {
    const utils = render(<SegmentedControl {...defaultProps} onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    const probe = group.querySelector('[data-measure]');
    if (!probe) throw new Error('probe not rendered');
    stubWidths(group, { offsetWidth: 100, clientWidth: 98 });
    stubWidths(probe, { offsetWidth: 126 });
    for (const cell of Array.from(probe.children)) {
      stubWidths(cell, { offsetWidth: 40 });
    }
    utils.rerender(<SegmentedControl {...defaultProps} onChange={onChange} />);
    return group;
  }

  it('re-lays overflowing segments into balanced equal-width rows', () => {
    const group = renderOverflowing();
    expect(group.className).toContain('flex-col');
    const rows = group.querySelectorAll(':scope > div:not([aria-hidden])');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll('[role="radio"]')).toHaveLength(2);
    expect(rows[1].querySelectorAll('[role="radio"]')).toHaveLength(1);
    expect(rows[1].textContent).toBe('Table');
  });

  it('keeps every option selectable and arrow-navigable in grid mode', () => {
    const onChange = vi.fn();
    renderOverflowing(onChange);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'List' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('grid');
    fireEvent.click(screen.getByRole('radio', { name: 'Table' }));
    expect(onChange).toHaveBeenCalledWith('table');
  });
});

describe('computeRowSizes', () => {
  it('splits into the fewest balanced rows that fit', () => {
    expect(computeRowSizes([40, 40, 40], 99)).toEqual([2, 1]);
    expect(computeRowSizes([30, 30, 30, 30], 100)).toEqual([2, 2]);
    expect(computeRowSizes([30, 30, 30, 30, 30], 100)).toEqual([3, 2]);
  });

  it('places the remainder on whichever row fits it', () => {
    expect(computeRowSizes([80, 20, 20], 90)).toEqual([1, 2]);
  });

  it('stacks one cell per row when nothing narrower fits', () => {
    expect(computeRowSizes([40, 40, 40], 78)).toEqual([1, 1, 1]);
    expect(computeRowSizes([200], 90)).toEqual([1]);
  });

  it('stays bounded and returns a full partition for pathological option counts', () => {
    const sizes = computeRowSizes(
      Array.from({ length: 40 }, () => 50),
      120
    );
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(40);
  });
});
