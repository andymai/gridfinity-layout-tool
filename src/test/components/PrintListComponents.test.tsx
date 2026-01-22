import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrintListSummary, PrintListEmpty } from '@/features/print-export';
import { SplitPreview } from '@/components/Print/SplitPreview';
import type { PrintPiece } from '@/core/types';

describe('PrintListSummary', () => {
  const defaultProps = {
    totalBins: 10,
    totalPieces: 15,
    totalFilament: 25.5,
    totalCost: 1.94,
    totalPrintTimeHours: 8.5,
    spoolPercentage: 7.7,
    hasAnySplits: true,
  };

  describe('desktop layout', () => {
    it('renders total bins', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('10 bins, 15 pieces')).toBeInTheDocument();
    });

    it('shows filament amount', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('Filament')).toBeInTheDocument();
      expect(screen.getByText('25.5m')).toBeInTheDocument();
    });

    it('shows estimated cost', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('Est. Cost')).toBeInTheDocument();
      expect(screen.getByText('$1.94')).toBeInTheDocument();
    });

    it('shows print time', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('Print Time')).toBeInTheDocument();
      expect(screen.getByText(/~8h 30m/)).toBeInTheDocument();
    });

    it('shows spool percentage', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('Spool')).toBeInTheDocument();
      expect(screen.getByText('7.7%')).toBeInTheDocument();
    });

    it('shows spool count when over 100%', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={250} />);

      expect(screen.getByText('2.5 spools')).toBeInTheDocument();
    });

    it('hides pieces when no splits', () => {
      render(<PrintListSummary {...defaultProps} hasAnySplits={false} />);

      expect(screen.getByText('10 bins')).toBeInTheDocument();
      expect(screen.queryByText(/pieces/)).not.toBeInTheDocument();
    });

    it('has tooltips on metrics', () => {
      const { container } = render(<PrintListSummary {...defaultProps} />);

      expect(container.querySelector('[title*="Estimated 1.75mm PLA"]')).toBeInTheDocument();
      expect(container.querySelector('[title*="$15/kg"]')).toBeInTheDocument();
      expect(container.querySelector('[title*="0.4mm nozzle"]')).toBeInTheDocument();
      expect(container.querySelector('[title*="1kg spool"]')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders compact layout', () => {
      render(<PrintListSummary {...defaultProps} compact={true} />);

      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('10 bins, 15 pcs')).toBeInTheDocument();
    });

    it('shows all metrics in compact layout', () => {
      render(<PrintListSummary {...defaultProps} compact={true} />);

      expect(screen.getByText('Filament')).toBeInTheDocument();
      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Spool')).toBeInTheDocument();
    });

    it('uses abbreviated labels', () => {
      render(<PrintListSummary {...defaultProps} compact={true} />);

      // Compact mode uses "Cost" instead of "Est. Cost"
      expect(screen.getByText('Cost')).toBeInTheDocument();
    });
  });
});

describe('SplitPreview', () => {
  const pieces: PrintPiece[] = [{ width: 4, depth: 4, count: 4 }];

  it('renders split pieces', () => {
    render(<SplitPreview width={8} depth={8} pieces={pieces} />);

    // Should show 4 pieces, each labeled 4×4
    expect(screen.getAllByText('4×4')).toHaveLength(4);
  });

  it('positions pieces correctly', () => {
    const { container } = render(<SplitPreview width={8} depth={8} pieces={pieces} />);

    const pieceElements = container.querySelectorAll('.absolute');
    expect(pieceElements.length).toBe(4);
  });

  it('applies custom cell size', () => {
    const { container } = render(
      <SplitPreview width={8} depth={8} pieces={pieces} cellSize={20} />
    );

    const wrapper = container.querySelector('.relative');
    expect(wrapper).toHaveStyle({ width: '174px' }); // 8 * 20 + 7 * 2 = 174
  });

  it('applies custom gap', () => {
    const { container } = render(<SplitPreview width={8} depth={8} pieces={pieces} gap={4} />);

    const wrapper = container.querySelector('.relative');
    expect(wrapper).toHaveStyle({ width: '156px' }); // 8 * 16 + 7 * 4 = 156
  });

  it('handles mixed piece sizes', () => {
    const mixedPieces: PrintPiece[] = [
      { width: 3, depth: 3, count: 2 },
      { width: 2, depth: 2, count: 1 },
    ];

    render(<SplitPreview width={6} depth={6} pieces={mixedPieces} />);

    expect(screen.getAllByText('3×3')).toHaveLength(2);
    expect(screen.getByText('2×2')).toBeInTheDocument();
  });

  it('handles single piece', () => {
    const singlePiece: PrintPiece[] = [{ width: 6, depth: 6, count: 1 }];

    render(<SplitPreview width={6} depth={6} pieces={singlePiece} />);

    expect(screen.getByText('6×6')).toBeInTheDocument();
  });

  it('calculates container dimensions', () => {
    const { container } = render(
      <SplitPreview width={4} depth={6} pieces={[{ width: 2, depth: 2, count: 6 }]} />
    );

    const wrapper = container.querySelector('.relative');
    // width: 4 * 16 + 3 * 2 = 70
    // height: 6 * 16 + 5 * 2 = 106
    expect(wrapper).toHaveStyle({ width: '70px', height: '106px' });
  });
});

describe('PrintListEmpty', () => {
  describe('default layout', () => {
    it('renders empty state message', () => {
      render(<PrintListEmpty />);

      expect(screen.getByText('No bins placed yet')).toBeInTheDocument();
      expect(screen.getByText('Draw or click to place bins on the grid')).toBeInTheDocument();
    });

    it('renders icon', () => {
      const { container } = render(<PrintListEmpty />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has empty-state class', () => {
      const { container } = render(<PrintListEmpty />);

      expect(container.querySelector('.empty-state')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders compact empty state message', () => {
      render(<PrintListEmpty compact={true} />);

      expect(screen.getByText('No bins to print')).toBeInTheDocument();
      expect(screen.getByText('Draw bins on the grid to see them here')).toBeInTheDocument();
    });

    it('renders larger icon in compact mode', () => {
      const { container } = render(<PrintListEmpty compact={true} />);

      const svg = container.querySelector('.w-8.h-8');
      expect(svg).toBeInTheDocument();
    });

    it('renders circular icon container in compact mode', () => {
      const { container } = render(<PrintListEmpty compact={true} />);

      expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    });
  });
});
