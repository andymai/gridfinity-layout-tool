import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SplitViewStrip } from './SplitViewStrip';
import type { BaseplateTiling } from '../../types/tiling';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const basePieceFields = {
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'none',
  fractionalEdgeY: 'none',
  edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
} as const;

const baseTiling: BaseplateTiling = {
  isSplit: true,
  cols: 2,
  rows: 1,
  colSizes: [5, 4],
  rowSizes: [6],
  pieces: [
    {
      ...basePieceFields,
      label: 'A1',
      col: 0,
      row: 0,
      widthUnits: 5,
      depthUnits: 6,
      gridOffsetX: 0,
      gridOffsetY: 0,
      edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
      placementRotationDeg: 0,
    },
    {
      ...basePieceFields,
      label: 'B1',
      col: 1,
      row: 0,
      widthUnits: 4,
      depthUnits: 6,
      gridOffsetX: 5,
      gridOffsetY: 0,
      edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      placementRotationDeg: 0,
    },
  ],
  margins: [],
  totalWidthUnits: 9,
  totalDepthUnits: 6,
  stackCount: 1,
  stackSeparatorThickness: 0,
  bedLoads: 1,
  paddingReductionHint: null,
  isCustomSplit: false,
  bedOverages: [],
};

function lanes(axis: 'Vertical' | 'Horizontal'): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-label') === `baseplate.splitSeam${axis}`);
}

describe('SplitViewStrip', () => {
  const defaultProps = {
    tiling: baseTiling,
    hoveredPieceLabel: null,
    selectedPieceLabel: null,
    onHoverPiece: vi.fn(),
    onSelectPiece: vi.fn(),
    printBedSize: 256,
    fractionalEdgeX: 'end' as const,
    fractionalEdgeY: 'end' as const,
    onChangeSplit: vi.fn(),
  };

  it('renders split info and reason', () => {
    render(<SplitViewStrip {...defaultProps} />);
    expect(screen.getByText('baseplate.splitInfo.other')).toBeInTheDocument();
    expect(screen.getByText('baseplate.splitReason')).toBeInTheDocument();
  });

  // Merging a custom plan back to one piece keeps this strip mounted, a state
  // the automatic path never rendered it in.
  it('uses the singular piece count when a custom plan leaves one piece', () => {
    render(
      <SplitViewStrip
        {...defaultProps}
        tiling={{ ...baseTiling, isCustomSplit: true, pieces: [baseTiling.pieces[0]] }}
      />
    );
    expect(screen.getByText('baseplate.splitInfo.one')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.splitInfo.other')).not.toBeInTheDocument();
  });

  it('renders the build-plate load count (singular at 1)', () => {
    render(<SplitViewStrip {...defaultProps} />);
    expect(screen.getByText('baseplate.bedLoads.one')).toBeInTheDocument();
  });

  it('renders the build-plate load count (plural above 1)', () => {
    render(<SplitViewStrip {...defaultProps} tiling={{ ...baseTiling, bedLoads: 3 }} />);
    expect(screen.getByText('baseplate.bedLoads.other')).toBeInTheDocument();
  });

  it('renders one button per piece', () => {
    render(<SplitViewStrip {...defaultProps} />);
    const pieceButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
    expect(pieceButtons).toHaveLength(2);
  });

  it('omits the padding hint when no hint is present', () => {
    render(<SplitViewStrip {...defaultProps} />);
    expect(screen.queryByText('baseplate.paddingHint')).not.toBeInTheDocument();
  });

  it('renders the padding reduction hint when present', () => {
    const tilingWithHint: BaseplateTiling = {
      ...baseTiling,
      paddingReductionHint: { axis: 'x', reductionMm: 10, piecesSaved: 2 },
    };
    render(<SplitViewStrip {...defaultProps} tiling={tilingWithHint} />);
    expect(screen.getByText('baseplate.paddingHint')).toBeInTheDocument();
  });

  it('calls onHoverPiece on pointer enter and leave', () => {
    const onHoverPiece = vi.fn();
    render(<SplitViewStrip {...defaultProps} onHoverPiece={onHoverPiece} />);
    const a1 = screen.getByText('A1');
    fireEvent.pointerEnter(a1);
    expect(onHoverPiece).toHaveBeenCalledWith('A1');
    fireEvent.pointerLeave(a1);
    expect(onHoverPiece).toHaveBeenCalledWith(null);
  });

  it('calls onSelectPiece with label on click', () => {
    const onSelectPiece = vi.fn();
    render(<SplitViewStrip {...defaultProps} onSelectPiece={onSelectPiece} />);
    fireEvent.click(screen.getByText('A1'));
    expect(onSelectPiece).toHaveBeenCalledWith('A1');
  });

  it('toggles selection (deselects) when clicking the already-selected piece', () => {
    const onSelectPiece = vi.fn();
    render(
      <SplitViewStrip {...defaultProps} selectedPieceLabel="A1" onSelectPiece={onSelectPiece} />
    );
    fireEvent.click(screen.getByText('A1'));
    expect(onSelectPiece).toHaveBeenCalledWith(null);
  });

  describe('seam editing', () => {
    it('renders one lane per legal cut offset on each axis', () => {
      render(<SplitViewStrip {...defaultProps} />);
      // A 9-unit axis has 8 interior boundaries, a 6-unit axis has 5.
      expect(lanes('Vertical')).toHaveLength(8);
      expect(lanes('Horizontal')).toHaveLength(5);
    });

    it('marks only the lanes carrying an existing seam as pressed', () => {
      render(<SplitViewStrip {...defaultProps} />);
      const pressed = lanes('Vertical').filter((b) => b.getAttribute('aria-pressed') === 'true');
      expect(pressed).toHaveLength(1);
      // colSizes [5, 4] puts the single seam at offset 5, the 5th of 8 lanes.
      expect(lanes('Vertical').indexOf(pressed[0])).toBe(4);
    });

    it('adds a seam when an unset lane is clicked', () => {
      const onChangeSplit = vi.fn();
      render(<SplitViewStrip {...defaultProps} onChangeSplit={onChangeSplit} />);
      // Lane index 1 is offset 2, giving [2, 3, 4] alongside the existing seam at 5.
      fireEvent.click(lanes('Vertical')[1]);
      expect(onChangeSplit).toHaveBeenCalledWith({ cols: [2, 3, 4], rows: [6] });
    });

    it('removes a seam when its lane is clicked again', () => {
      const onChangeSplit = vi.fn();
      render(<SplitViewStrip {...defaultProps} onChangeSplit={onChangeSplit} />);
      fireEvent.click(lanes('Vertical')[4]);
      expect(onChangeSplit).toHaveBeenCalledWith({ cols: [9], rows: [6] });
    });

    it('cuts the depth axis from the front, matching the map drawn front-at-bottom', () => {
      const onChangeSplit = vi.fn();
      render(<SplitViewStrip {...defaultProps} onChangeSplit={onChangeSplit} />);
      fireEvent.click(lanes('Horizontal')[1]);
      expect(onChangeSplit).toHaveBeenCalledWith({ cols: [5, 4], rows: [2, 4] });
    });

    it('shows the custom caption instead of the bed reason under a custom plan', () => {
      render(<SplitViewStrip {...defaultProps} tiling={{ ...baseTiling, isCustomSplit: true }} />);
      expect(screen.getByText('baseplate.splitCustom')).toBeInTheDocument();
      expect(screen.queryByText('baseplate.splitReason')).not.toBeInTheDocument();
    });

    it('offers reset-to-automatic only under a custom plan', () => {
      const { rerender } = render(<SplitViewStrip {...defaultProps} />);
      expect(screen.queryByText('baseplate.splitResetAuto')).not.toBeInTheDocument();

      const onChangeSplit = vi.fn();
      rerender(
        <SplitViewStrip
          {...defaultProps}
          tiling={{ ...baseTiling, isCustomSplit: true }}
          onChangeSplit={onChangeSplit}
        />
      );
      fireEvent.click(screen.getByText('baseplate.splitResetAuto'));
      expect(onChangeSplit).toHaveBeenCalledWith(undefined);
    });
  });

  describe('over-bed pieces', () => {
    const overBed: BaseplateTiling = {
      ...baseTiling,
      isCustomSplit: true,
      bedOverages: [{ label: 'A1', overWidthMm: 44, overDepthMm: 0 }],
    };

    it('raises an alert naming the offending pieces', () => {
      render(<SplitViewStrip {...defaultProps} tiling={overBed} />);
      expect(screen.getByRole('alert')).toHaveTextContent('baseplate.splitOverBed');
    });

    it('labels the offending piece distinctly from a fitting one', () => {
      render(<SplitViewStrip {...defaultProps} tiling={overBed} />);
      expect(screen.getByText('A1')).toHaveAttribute('aria-label', 'baseplate.pieceLabelOverBed');
      expect(screen.getByText('B1')).toHaveAttribute('aria-label', 'baseplate.pieceLabel');
    });
  });
});
