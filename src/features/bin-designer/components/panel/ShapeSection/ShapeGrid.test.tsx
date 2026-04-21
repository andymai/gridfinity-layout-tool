import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildFullMask } from '@/shared/utils/cellMask';
import { ShapeGrid } from './ShapeGrid';

function renderGrid(overrides: Partial<Parameters<typeof ShapeGrid>[0]> = {}) {
  const mask = overrides.mask ?? buildFullMask(2, 2); // 4×4 cells
  const onToggleCell = overrides.onToggleCell ?? vi.fn();
  const cellLabel = overrides.cellLabel ?? ((c, r, f) => `c${c}r${r}-${f ? 'f' : 'e'}`);
  const ariaLabel = overrides.ariaLabel ?? 'Test grid';
  return {
    mask,
    onToggleCell,
    ...render(
      <ShapeGrid
        mask={mask}
        onToggleCell={onToggleCell}
        cellLabel={cellLabel}
        ariaLabel={ariaLabel}
      />
    ),
  };
}

describe('ShapeGrid', () => {
  it('renders a grid with rows*cols cells', () => {
    renderGrid();
    // 4×4 mask = 16 cells
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  it('reports aria-selected=true for filled cells and false for empty', () => {
    const mask = buildFullMask(1, 1); // 2×2, all filled
    mask.cells[0] = 0; // bottom-left empty
    renderGrid({ mask });
    const cells = screen.getAllByRole('gridcell');
    const empty = cells.find((c) => c.getAttribute('aria-selected') === 'false');
    const filled = cells.find((c) => c.getAttribute('aria-selected') === 'true');
    expect(empty).toBeDefined();
    expect(filled).toBeDefined();
  });

  it('calls onToggleCell with (col, row) on pointer-down', () => {
    const onToggleCell = vi.fn();
    renderGrid({ onToggleCell });
    const cells = screen.getAllByRole('gridcell');
    // DOM order matches data order (row 0 first); flex-col-reverse flips only
    // the visual stacking, so cells[0] = mask (col 0, row 0) = bottom-left.
    fireEvent.pointerDown(cells[0]);
    expect(onToggleCell).toHaveBeenCalledTimes(1);
    const [col, row] = onToggleCell.mock.calls[0];
    expect(col).toBe(0);
    expect(row).toBe(0);
  });

  it('drag-paints: subsequent pointer-enter cells follow the drag mode', () => {
    const onToggleCell = vi.fn();
    renderGrid({ onToggleCell });
    const cells = screen.getAllByRole('gridcell');
    // Start drag on first cell (toggles it).
    fireEvent.pointerDown(cells[0]);
    // Enter next cell with active drag -- should toggle too.
    fireEvent.pointerEnter(cells[1]);
    expect(onToggleCell).toHaveBeenCalledTimes(2);
  });

  it('does not re-toggle the same cell during one drag', () => {
    const onToggleCell = vi.fn();
    renderGrid({ onToggleCell });
    const cells = screen.getAllByRole('gridcell');
    fireEvent.pointerDown(cells[0]);
    fireEvent.pointerEnter(cells[0]); // re-enter same cell
    expect(onToggleCell).toHaveBeenCalledTimes(1);
  });

  it('ends the drag on pointer-up', () => {
    const onToggleCell = vi.fn();
    const { container } = renderGrid({ onToggleCell });
    const cells = screen.getAllByRole('gridcell');
    fireEvent.pointerDown(cells[0]);
    fireEvent.pointerUp(container.firstChild as Element);
    // Enter should no longer toggle now that drag ended.
    fireEvent.pointerEnter(cells[2]);
    expect(onToggleCell).toHaveBeenCalledTimes(1);
  });
});
