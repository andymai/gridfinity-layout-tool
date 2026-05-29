import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DividerHitTargets } from './DividerHitTargets';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';

const baseCompartments = (cols: number, rows: number): CompartmentConfig => ({
  cols,
  rows,
  thickness: 1.2,
  cells: Array.from({ length: cols * rows }, (_, i) => i),
});

const verticalDivider = (a = 0, b = 1, offsetStart = 0, offsetEnd = 0): EligibleDivider => ({
  compartmentA: a,
  compartmentB: b,
  axis: 'vertical',
  offsetStart,
  offsetEnd,
});

const horizontalDivider = (a = 0, b = 1): EligibleDivider => ({
  compartmentA: a,
  compartmentB: b,
  axis: 'horizontal',
  offsetStart: 0,
  offsetEnd: 0,
});

const noop = (): void => {};
const rowLabel = (a: number, b: number): string => `Edit divider between Comp ${a} and Comp ${b}`;

const baseProps = {
  interiorW: 80,
  interiorD: 40,
  preview: null,
  selectedKey: null,
  hoveredKey: null,
  onSelect: noop,
  onHoverChange: noop,
  rowLabel,
};

describe('DividerHitTargets', () => {
  it('renders one hit target per eligible divider', () => {
    render(
      <DividerHitTargets
        {...baseProps}
        compartments={baseCompartments(2, 2)}
        dividers={[verticalDivider(0, 1), horizontalDivider(0, 2)]}
      />
    );
    const targets = screen.getAllByRole('button', { name: /Edit divider between Comp/i });
    expect(targets).toHaveLength(2);
  });

  it('clicking a hit target calls onSelect with the divider key', () => {
    const onSelect = vi.fn();
    render(
      <DividerHitTargets
        {...baseProps}
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1)]}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit divider/i }));
    expect(onSelect).toHaveBeenCalledWith('0-1');
  });

  it('pointer enter/leave drives onHoverChange', () => {
    const onHoverChange = vi.fn();
    render(
      <DividerHitTargets
        {...baseProps}
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1)]}
        onHoverChange={onHoverChange}
      />
    );
    const target = screen.getByRole('button', { name: /Edit divider/i });
    fireEvent.pointerEnter(target);
    expect(onHoverChange).toHaveBeenLastCalledWith('0-1');
    fireEvent.pointerLeave(target);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it('draws a tilt line only for dividers that carry an offset', () => {
    const { container, rerender } = render(
      <DividerHitTargets
        {...baseProps}
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1, 0, 0)]}
      />
    );
    expect(container.querySelector('line')).toBeNull();

    rerender(
      <DividerHitTargets
        {...baseProps}
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1, -8, 8)]}
      />
    );
    expect(container.querySelector('line')).not.toBeNull();
  });

  it('uses the live preview offsets when the preview targets the divider', () => {
    const { container } = render(
      <DividerHitTargets
        {...baseProps}
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1, 0, 0)]}
        preview={{ key: '0-1', offsetStart: -6, offsetEnd: 6 }}
      />
    );
    // Straight committed override but an active preview → a tilt line appears.
    expect(container.querySelector('line')).not.toBeNull();
  });

  it('skips dividers with degenerate span (no shared run)', () => {
    const config: CompartmentConfig = { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] };
    render(
      <DividerHitTargets {...baseProps} compartments={config} dividers={[verticalDivider(0, 3)]} />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
