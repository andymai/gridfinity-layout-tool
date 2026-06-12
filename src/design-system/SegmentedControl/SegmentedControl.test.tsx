import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';
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
    expect(screen.getByRole('radio', { name: 'List' }).className).toContain('text-[11px]');
  });

  it('stretches segments equally when fullWidth', () => {
    render(<SegmentedControl {...defaultProps} fullWidth />);
    expect(screen.getByRole('radiogroup').className).toContain('w-full');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toContain('flex-1');
    }
  });

  it('applies className to the group container', () => {
    render(<SegmentedControl {...defaultProps} className="custom-class" />);
    expect(screen.getByRole('radiogroup')).toHaveClass('custom-class');
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
