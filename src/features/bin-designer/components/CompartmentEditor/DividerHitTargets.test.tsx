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

const verticalDivider = (a = 0, b = 1): EligibleDivider => ({
  compartmentA: a,
  compartmentB: b,
  axis: 'vertical',
  offsetStart: 0,
  offsetEnd: 0,
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

describe('DividerHitTargets', () => {
  it('renders one hit target per eligible divider', () => {
    render(
      <DividerHitTargets
        compartments={baseCompartments(2, 2)}
        dividers={[verticalDivider(0, 1), horizontalDivider(0, 2)]}
        selectedKey={null}
        hoveredKey={null}
        onSelect={noop}
        onHoverChange={noop}
        rowLabel={rowLabel}
      />
    );
    const targets = screen.getAllByRole('button', { name: /Edit divider between Comp/i });
    expect(targets).toHaveLength(2);
  });

  it('clicking a hit target calls onSelect with the divider key', () => {
    const onSelect = vi.fn();
    render(
      <DividerHitTargets
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1)]}
        selectedKey={null}
        hoveredKey={null}
        onSelect={onSelect}
        onHoverChange={noop}
        rowLabel={rowLabel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit divider/i }));
    expect(onSelect).toHaveBeenCalledWith('0-1');
  });

  it('pointer enter/leave drives onHoverChange', () => {
    const onHoverChange = vi.fn();
    render(
      <DividerHitTargets
        compartments={baseCompartments(2, 1)}
        dividers={[verticalDivider(0, 1)]}
        selectedKey={null}
        hoveredKey={null}
        onSelect={noop}
        onHoverChange={onHoverChange}
        rowLabel={rowLabel}
      />
    );
    const target = screen.getByRole('button', { name: /Edit divider/i });
    fireEvent.pointerEnter(target);
    expect(onHoverChange).toHaveBeenLastCalledWith('0-1');
    fireEvent.pointerLeave(target);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it('skips dividers with degenerate span (no shared run)', () => {
    // Compartments with no shared boundary — passing an EligibleDivider for them
    // would be malformed, but the helper should defensively skip rather than crash.
    const config: CompartmentConfig = {
      cols: 2,
      rows: 2,
      thickness: 1.2,
      // [0, 1, 2, 3] — every cell is its own compartment, so 0 and 3 are diagonal,
      // not adjacent. A divider claiming to span between them has no segment.
      cells: [0, 1, 2, 3],
    };
    render(
      <DividerHitTargets
        compartments={config}
        dividers={[
          {
            compartmentA: 0,
            compartmentB: 3,
            axis: 'vertical',
            offsetStart: 0,
            offsetEnd: 0,
          },
        ]}
        selectedKey={null}
        hoveredKey={null}
        onSelect={noop}
        onHoverChange={noop}
        rowLabel={rowLabel}
      />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
