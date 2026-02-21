import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrintListSummary } from '@/features/print-export';

describe('PrintListSummary', () => {
  const defaultProps = {
    totalBins: 10,
    totalPieces: 15,
    totalFilament: 25,
    totalCost: 3.75,
    totalPrintTimeHours: 8.5,
    spoolPercentage: 45,
    hasAnySplits: true,
    nozzleSizeMm: 0.4,
  };

  describe('desktop layout', () => {
    it('displays total bins count', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText(/10 bins/)).toBeInTheDocument();
    });

    it('displays pieces count when hasAnySplits is true', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText(/15 pcs/)).toBeInTheDocument();
    });

    it('hides pieces count when hasAnySplits is false', () => {
      render(<PrintListSummary {...defaultProps} hasAnySplits={false} />);

      expect(screen.queryByText(/pcs/)).not.toBeInTheDocument();
    });

    it('displays filament usage', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText(/~25m filament/)).toBeInTheDocument();
    });

    it('displays estimated cost', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('$3.75')).toBeInTheDocument();
    });

    it('displays print time', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText(/~8h 30m/)).toBeInTheDocument();
    });

    it('displays spool percentage when under 100%', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('displays spool count when over 100%', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={250} />);

      expect(screen.getByText('2.5 spools')).toBeInTheDocument();
    });

    it('has tooltips with explanations', () => {
      const { container } = render(<PrintListSummary {...defaultProps} />);

      const filamentRow = container.querySelector('[title*="1.75mm PLA"]');
      expect(filamentRow).toBeInTheDocument();

      const costRow = container.querySelector('[title*="$15/kg"]');
      expect(costRow).toBeInTheDocument();
    });

    it('renders progress bar for spool under 100%', () => {
      render(<PrintListSummary {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('hides progress bar when spool over 100%', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={150} />);

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('compact (mobile) layout', () => {
    it('displays bins and pieces in compact format', () => {
      render(<PrintListSummary {...defaultProps} compact />);

      expect(screen.getByText(/10 bins/)).toBeInTheDocument();
      expect(screen.getByText(/15 pcs/)).toBeInTheDocument();
    });

    it('displays primary stats prominently', () => {
      render(<PrintListSummary {...defaultProps} compact />);

      expect(screen.getByText(/~8h 30m/)).toBeInTheDocument();
      expect(screen.getByText('$3.75')).toBeInTheDocument();
    });

    it('displays filament in short format', () => {
      render(<PrintListSummary {...defaultProps} compact />);

      expect(screen.getByText(/~25m/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles zero values', () => {
      render(
        <PrintListSummary
          {...defaultProps}
          totalBins={0}
          totalPieces={0}
          totalFilament={0}
          totalCost={0}
          totalPrintTimeHours={0}
          spoolPercentage={0}
        />
      );

      expect(screen.getByText(/0 bins/)).toBeInTheDocument();
      expect(screen.getByText(/~0m filament/)).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('handles exactly 100% spool usage', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={100} />);

      expect(screen.getByText('1 spool')).toBeInTheDocument();
    });

    it('handles fractional spool percentages', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={175} />);

      expect(screen.getByText('1.8 spools')).toBeInTheDocument();
    });
  });
});
