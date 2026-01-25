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
  };

  describe('desktop layout', () => {
    it('displays total bins count', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText(/10 bin\(s\) total/)).toBeInTheDocument();
    });

    it('displays pieces count when hasAnySplits is true', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText(/15 piece\(s\)/)).toBeInTheDocument();
    });

    it('hides pieces count when hasAnySplits is false', () => {
      render(<PrintListSummary {...defaultProps} hasAnySplits={false} />);

      expect(screen.queryByText(/pieces/)).not.toBeInTheDocument();
    });

    it('displays filament usage', () => {
      render(<PrintListSummary {...defaultProps} />);

      expect(screen.getByText('25m')).toBeInTheDocument();
    });

    it('displays estimated cost', () => {
      render(<PrintListSummary {...defaultProps} />);

      // formatCost formats as currency
      expect(screen.getByText('$3.75')).toBeInTheDocument();
    });

    it('displays print time', () => {
      render(<PrintListSummary {...defaultProps} />);

      // formatPrintTime should format hours, appears twice (once in label, once as value)
      expect(screen.getAllByText(/~8.*h/)[0]).toBeInTheDocument();
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
  });

  describe('compact (mobile) layout', () => {
    it('displays bins and pieces in compact format', () => {
      render(<PrintListSummary {...defaultProps} compact />);

      expect(screen.getByText('bins & pieces')).toBeInTheDocument();
    });

    it('displays all stats in grid', () => {
      render(<PrintListSummary {...defaultProps} compact />);

      expect(screen.getByText('Filament')).toBeInTheDocument();
      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Spool')).toBeInTheDocument();
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

      expect(screen.getByText(/0 bin\(s\) total/)).toBeInTheDocument();
      expect(screen.getByText('0m')).toBeInTheDocument();
    });

    it('handles exactly 100% spool usage', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={100} />);

      expect(screen.getByText('1 spools')).toBeInTheDocument();
    });

    it('handles fractional spool percentages', () => {
      render(<PrintListSummary {...defaultProps} spoolPercentage={175} />);

      expect(screen.getByText('1.8 spools')).toBeInTheDocument();
    });
  });
});
