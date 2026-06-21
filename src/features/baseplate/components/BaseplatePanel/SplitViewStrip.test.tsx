import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SplitViewStrip } from './SplitViewStrip';
import type { BaseplateTiling } from '../../types/tiling';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, params?: Record<string, unknown>): string => {
      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{${k}}`, String(v)),
          key
        );
      }
      return key;
    },
}));

const baseTiling: BaseplateTiling = {
  isSplit: true,
  cols: 2,
  rows: 1,
  pieces: [
    {
      label: 'A1',
      col: 0,
      row: 0,
      widthUnits: 5,
      depthUnits: 4,
      gridOffsetX: 0,
      gridOffsetY: 0,
      placementRotationDeg: 0,
    },
    {
      label: 'B1',
      col: 1,
      row: 0,
      widthUnits: 4,
      depthUnits: 4,
      gridOffsetX: 5,
      gridOffsetY: 0,
      placementRotationDeg: 0,
    },
  ],
  totalWidthUnits: 9,
  totalDepthUnits: 6,
  stackCount: 1,
  stackSeparatorThickness: 0,
  bedLoads: 1,
};

describe('SplitViewStrip', () => {
  const defaultProps = {
    tiling: baseTiling,
    hoveredPieceLabel: null,
    selectedPieceLabel: null,
    onHoverPiece: vi.fn(),
    onSelectPiece: vi.fn(),
    printBedSize: 256,
  };

  it('renders split info and reason', () => {
    render(<SplitViewStrip {...defaultProps} />);
    expect(screen.getByText('baseplate.splitInfo')).toBeInTheDocument();
    expect(screen.getByText('baseplate.splitReason')).toBeInTheDocument();
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
});
