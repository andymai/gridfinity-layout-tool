import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompartmentSizeOverlay } from './CompartmentSizeOverlay';
import type { CompartmentConfig } from '@/features/bin-designer/types';

// 2x2 grid, one compartment per cell.
const grid: CompartmentConfig = { cols: 2, rows: 2, thickness: 2, cells: [0, 1, 2, 3] };

const BIG = { boxWidthPx: 600, boxHeightPx: 400 };

describe('CompartmentSizeOverlay', () => {
  it('labels every compartment once', () => {
    render(<CompartmentSizeOverlay compartments={grid} interiorW={100} interiorD={80} {...BIG} />);

    // Interior cells lose half a wall on the shared edge only:
    // 50 - 1 = 49 wide, 40 - 1 = 39 deep.
    expect(screen.getAllByText('49 × 39')).toHaveLength(4);
  });

  it('labels a merged compartment once, at its full size', () => {
    const merged: CompartmentConfig = { ...grid, cells: [0, 0, 1, 2] };
    render(
      <CompartmentSizeOverlay compartments={merged} interiorW={100} interiorD={80} {...BIG} />
    );

    // Compartment 0 spans both columns of row 0: full 100 wide, 39 deep.
    expect(screen.getByText('100 × 39')).toBeInTheDocument();
  });

  it('follows a wall that has been dragged off its grid line', () => {
    const shifted: CompartmentConfig = {
      ...grid,
      // Move the wall between compartments 0 and 1 by 10mm toward +X.
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: 10 }],
    };
    render(
      <CompartmentSizeOverlay compartments={shifted} interiorW={100} interiorD={80} {...BIG} />
    );

    // Nominal 49 wide either side; the shift grows the left one and shrinks
    // the right. A readout that ignored the override would print 49 twice.
    expect(screen.getByText('59 × 39')).toBeInTheDocument();
    expect(screen.getByText('39 × 39')).toBeInTheDocument();
  });

  it('follows a wall dragged along the depth axis too', () => {
    const shifted: CompartmentConfig = {
      ...grid,
      // Compartments 0 and 2 sit in the same column, stacked in Y.
      dividerOverrides: [{ compartmentA: 0, compartmentB: 2, offsetStart: 8, offsetEnd: 8 }],
    };
    render(
      <CompartmentSizeOverlay compartments={shifted} interiorW={100} interiorD={80} {...BIG} />
    );

    // The depth axis is a separate code path from the width axis, and a sign
    // error there would only ever show up here.
    expect(screen.getByText('49 × 47')).toBeInTheDocument();
    expect(screen.getByText('49 × 31')).toBeInTheDocument();
  });

  it('drops labels that cannot fit their compartment', () => {
    const { container } = render(
      <CompartmentSizeOverlay
        compartments={grid}
        interiorW={100}
        interiorD={80}
        boxWidthPx={60}
        boxHeightPx={40}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing rather than an empty overlay when every label is dropped', () => {
    const { container } = render(
      <CompartmentSizeOverlay
        compartments={grid}
        interiorW={100}
        interiorD={80}
        boxWidthPx={0}
        boxHeightPx={0}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('stays out of the pointer path', () => {
    const { container } = render(
      <CompartmentSizeOverlay compartments={grid} interiorW={100} interiorD={80} {...BIG} />
    );

    expect((container.firstChild as HTMLElement).className).toContain('pointer-events-none');
  });
});
