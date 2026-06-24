import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GridCell, GhostPreview } from './CompartmentEditorParts';
import type { CompartmentConfig } from '@/features/bin-designer/types';

const previewColor = '#d4d8dc';

function makeConfig(overrides: Partial<CompartmentConfig> = {}): CompartmentConfig {
  return {
    cols: 2,
    rows: 2,
    thickness: 1.2,
    cells: [0, 1, 2, 3],
    ...overrides,
  };
}

describe('GridCell', () => {
  it('renders an interactive cell with role=button', () => {
    render(
      <GridCell
        idx={0}
        compartmentId={0}
        isSelected={false}
        isHovered={false}
        isSplittable={false}
        isDragging={false}
        config={makeConfig()}
        previewColor={previewColor}
        onPointerDown={vi.fn()}
        onPointerEnter={vi.fn()}
        onPointerLeave={vi.fn()}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows the cell-span label on a multi-cell compartment anchor cell', () => {
    // 2x2 grid where all cells share id=0 (one big merged compartment)
    const config = makeConfig({ cells: [0, 0, 0, 0] });
    // idx=2 is row=1,col=0 — visual top-left under flex-col-reverse
    render(
      <GridCell
        idx={2}
        compartmentId={0}
        isSelected={false}
        isHovered
        isSplittable
        isDragging={false}
        config={config}
        previewColor={previewColor}
        onPointerDown={vi.fn()}
        onPointerEnter={vi.fn()}
        onPointerLeave={vi.fn()}
      />
    );
    expect(screen.getByText('2×2')).toBeInTheDocument();
  });

  it('marks aria-pressed when selected', () => {
    render(
      <GridCell
        idx={0}
        compartmentId={0}
        isSelected
        isHovered={false}
        isSplittable={false}
        isDragging
        config={makeConfig()}
        previewColor={previewColor}
        onPointerDown={vi.fn()}
        onPointerEnter={vi.fn()}
        onPointerLeave={vi.fn()}
      />
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('always shows a compartment label when text is present (both modes)', () => {
    render(
      <GridCell
        idx={0}
        compartmentId={0}
        isSelected={false}
        isHovered={false}
        isSplittable={false}
        isDragging={false}
        labelMode={false}
        labelText="SCREWS"
        displayNumber={1}
        config={makeConfig()}
        previewColor={previewColor}
        onPointerDown={vi.fn()}
        onPointerEnter={vi.fn()}
        onPointerLeave={vi.fn()}
      />
    );
    expect(screen.getByText('SCREWS')).toBeInTheDocument();
    // Full text available via title for truncation overflow.
    expect(screen.getByTitle('SCREWS')).toBeInTheDocument();
    // Labeled compartments announce their label to screen readers.
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('SCREWS')
    );
  });

  it('shows the compartment number on an empty cell only while labeling', () => {
    const props = {
      idx: 0,
      compartmentId: 0,
      isSelected: false,
      isHovered: false,
      isSplittable: false,
      isDragging: false,
      labelText: '',
      displayNumber: 3,
      config: makeConfig(),
      previewColor,
      onPointerDown: vi.fn(),
      onPointerEnter: vi.fn(),
      onPointerLeave: vi.fn(),
    };
    const { rerender } = render(<GridCell {...props} labelMode={false} />);
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    rerender(<GridCell {...props} labelMode />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('announces the compartment number (not a grid coordinate) on empty cells in label mode', () => {
    const props = {
      idx: 0,
      compartmentId: 0,
      isSelected: false,
      isHovered: false,
      isSplittable: false,
      isDragging: false,
      labelText: '',
      displayNumber: 3,
      config: makeConfig(),
      previewColor,
      onPointerDown: vi.fn(),
      onPointerEnter: vi.fn(),
      onPointerLeave: vi.fn(),
    };
    const { rerender } = render(<GridCell {...props} labelMode={false} />);
    // Divider mode: a plain grid coordinate.
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Cell 1, 1');
    rerender(<GridCell {...props} labelMode />);
    // Label mode: announces the labeling target by compartment number.
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Compartment 3');
  });

  it('reflects label selection (not divider selection) in aria-pressed while labeling', () => {
    const props = {
      idx: 0,
      compartmentId: 0,
      isSelected: false,
      isHovered: false,
      isSplittable: false,
      isDragging: false,
      labelMode: true,
      labelText: '',
      displayNumber: 1,
      config: makeConfig(),
      previewColor,
      onPointerDown: vi.fn(),
      onPointerEnter: vi.fn(),
      onPointerLeave: vi.fn(),
    };
    const { rerender } = render(<GridCell {...props} isLabelSelected={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<GridCell {...props} isLabelSelected />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a selection ring on the compartment being labeled', () => {
    render(
      <GridCell
        idx={0}
        compartmentId={0}
        isSelected={false}
        isHovered={false}
        isSplittable={false}
        isDragging={false}
        labelMode
        isLabelSelected
        labelText="M3"
        displayNumber={1}
        config={makeConfig()}
        previewColor={previewColor}
        onPointerDown={vi.fn()}
        onPointerEnter={vi.fn()}
        onPointerLeave={vi.fn()}
      />
    );
    expect(screen.getByRole('button').style.boxShadow).toContain('var(--color-accent)');
  });
});

describe('GhostPreview', () => {
  it('returns null when selectionAction is none', () => {
    const { container } = render(
      <GhostPreview selection={new Set([0, 1])} selectionAction="none" cols={2} rows={2} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a single overlay for merge action', () => {
    const { container } = render(
      <GhostPreview selection={new Set([0, 1, 2, 3])} selectionAction="merge" cols={2} rows={2} />
    );
    const overlays = container.querySelectorAll('div');
    expect(overlays.length).toBe(1);
  });

  it('renders one overlay per cell for split action', () => {
    const { container } = render(
      <GhostPreview selection={new Set([0, 1, 2])} selectionAction="split" cols={2} rows={2} />
    );
    const overlays = container.querySelectorAll('div');
    expect(overlays.length).toBe(3);
  });
});
