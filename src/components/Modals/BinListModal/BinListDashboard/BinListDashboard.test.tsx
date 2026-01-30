import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinListDashboard } from '@/components/Modals/BinListModal/BinListDashboard';
import type { CategoryBreakdown } from '@/shared/utils/binListOperations';

// Mock the BinList components
vi.mock('../StatCard', () => ({
  StatCard: ({
    icon,
    label,
    value,
    unit,
    title,
    variant,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    unit?: string;
    title?: string;
    variant?: string;
  }) => (
    <div data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`} title={title}>
      <span data-testid="icon">{icon}</span>
      <span data-testid="label">{label}</span>
      <span data-testid="value">{value}</span>
      {unit && <span data-testid="unit">{unit}</span>}
      {variant && <span data-testid="variant">{variant}</span>}
    </div>
  ),
  BinIcon: () => <span>BinIcon</span>,
  FilamentIcon: () => <span>FilamentIcon</span>,
  CostIcon: () => <span>CostIcon</span>,
  TimeIcon: () => <span>TimeIcon</span>,
  SpoolIcon: () => <span>SpoolIcon</span>,
}));

vi.mock('../CategoryBreakdownChart', () => ({
  CategoryBreakdownChart: ({ breakdown }: { breakdown: CategoryBreakdown[] }) => (
    <div data-testid="category-breakdown-chart">{breakdown.length} categories</div>
  ),
  CategoryStackedBar: ({
    breakdown,
    height,
  }: {
    breakdown: CategoryBreakdown[];
    height?: string;
  }) => (
    <div data-testid="category-stacked-bar" data-height={height}>
      {breakdown.length} categories
    </div>
  ),
  CategoryLegend: ({ breakdown }: { breakdown: CategoryBreakdown[] }) => (
    <div data-testid="category-legend">{breakdown.length} legend items</div>
  ),
}));

describe('BinListDashboard', () => {
  const mockCategoryBreakdown: CategoryBreakdown[] = [
    {
      categoryId: 'coral',
      categoryName: 'Coral',
      categoryColor: '#FF6B6B',
      filament: 15,
      cost: 1.14,
      binCount: 7,
      percentage: 60,
    },
    {
      categoryId: 'blue',
      categoryName: 'Blue',
      categoryColor: '#4ECDC4',
      filament: 10,
      cost: 0.76,
      binCount: 5,
      percentage: 40,
    },
  ];

  const defaultProps = {
    totalBinTypes: 5,
    totalBins: 12,
    totalPieces: 20,
    totalFilament: 25.5,
    totalCost: 1.94,
    totalPrintTimeHours: 8.5,
    spoolEstimate: 1,
    spoolPercentage: 7.7,
    hasAnySplits: true,
    categoryBreakdown: mockCategoryBreakdown,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders statistics header', () => {
      render(<BinListDashboard {...defaultProps} />);

      // Header is only shown when collapsible
      expect(screen.queryByText('Statistics')).not.toBeInTheDocument();
    });

    it('renders bin types stat', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-bin-types')).toBeInTheDocument();
    });

    it('renders total bins stat', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-total-bins')).toBeInTheDocument();
    });

    it('renders filament stat', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-filament')).toBeInTheDocument();
    });

    it('renders estimated cost stat', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-est.-cost')).toBeInTheDocument();
    });

    it('renders print time stat', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-print-time')).toBeInTheDocument();
    });

    it('renders spools stat', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-spools')).toBeInTheDocument();
    });

    it('renders print pieces when hasAnySplits is true', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-print-pieces')).toBeInTheDocument();
    });

    it('does not render print pieces when hasAnySplits is false', () => {
      render(<BinListDashboard {...defaultProps} hasAnySplits={false} />);

      expect(screen.queryByTestId('stat-print-pieces')).not.toBeInTheDocument();
    });

    it('renders category breakdown chart', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('category-breakdown-chart')).toBeInTheDocument();
    });

    it('renders category legend', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('category-legend')).toBeInTheDocument();
    });

    it('renders "Filament by Category" header', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByText('Filament by Category')).toBeInTheDocument();
    });
  });

  describe('empty category breakdown', () => {
    it('does not render category section when breakdown is empty', () => {
      render(<BinListDashboard {...defaultProps} categoryBreakdown={[]} />);

      expect(screen.queryByText('Filament by Category')).not.toBeInTheDocument();
      expect(screen.queryByTestId('category-breakdown-chart')).not.toBeInTheDocument();
    });
  });

  describe('print time formatting', () => {
    it('formats time less than 1 hour as minutes', () => {
      render(<BinListDashboard {...defaultProps} totalPrintTimeHours={0.5} />);

      const printTimeStat = screen.getByTestId('stat-print-time');
      expect(printTimeStat.querySelector('[data-testid="value"]')?.textContent).toBe('30m');
    });

    it('formats whole hours without minutes', () => {
      render(<BinListDashboard {...defaultProps} totalPrintTimeHours={3} />);

      const printTimeStat = screen.getByTestId('stat-print-time');
      expect(printTimeStat.querySelector('[data-testid="value"]')?.textContent).toBe('3h');
    });

    it('formats hours with minutes', () => {
      render(<BinListDashboard {...defaultProps} totalPrintTimeHours={2.5} />);

      const printTimeStat = screen.getByTestId('stat-print-time');
      expect(printTimeStat.querySelector('[data-testid="value"]')?.textContent).toBe('2h 30m');
    });

    it('rounds minutes', () => {
      render(<BinListDashboard {...defaultProps} totalPrintTimeHours={1.75} />);

      const printTimeStat = screen.getByTestId('stat-print-time');
      expect(printTimeStat.querySelector('[data-testid="value"]')?.textContent).toBe('1h 45m');
    });
  });

  describe('stat values', () => {
    it('displays correct bin types count', () => {
      render(<BinListDashboard {...defaultProps} />);

      const stat = screen.getByTestId('stat-bin-types');
      expect(stat.querySelector('[data-testid="value"]')?.textContent).toBe('5');
    });

    it('displays correct total bins count', () => {
      render(<BinListDashboard {...defaultProps} />);

      const stat = screen.getByTestId('stat-total-bins');
      expect(stat.querySelector('[data-testid="value"]')?.textContent).toBe('12');
    });

    it('displays correct filament value', () => {
      render(<BinListDashboard {...defaultProps} />);

      const stat = screen.getByTestId('stat-filament');
      expect(stat.querySelector('[data-testid="value"]')?.textContent).toBe('25.5');
      expect(stat.querySelector('[data-testid="unit"]')?.textContent).toBe('m');
    });

    it('displays correct cost value', () => {
      render(<BinListDashboard {...defaultProps} />);

      const stat = screen.getByTestId('stat-est.-cost');
      expect(stat.querySelector('[data-testid="value"]')?.textContent).toBe('$1.94');
    });

    it('displays spool percentage in unit', () => {
      render(<BinListDashboard {...defaultProps} />);

      const stat = screen.getByTestId('stat-spools');
      expect(stat.querySelector('[data-testid="unit"]')?.textContent).toBe('(7.7%)');
    });
  });

  describe('stat titles', () => {
    it('bin types stat has correct title', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-bin-types')).toHaveAttribute(
        'title',
        '5 unique bin configurations'
      );
    });

    it('total bins stat has correct title', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-total-bins')).toHaveAttribute('title', '12 individual bins');
    });

    it('print pieces stat has correct title', () => {
      render(<BinListDashboard {...defaultProps} />);

      expect(screen.getByTestId('stat-print-pieces')).toHaveAttribute(
        'title',
        '20 pieces after split optimization'
      );
    });
  });

  describe('collapsible mode', () => {
    it('shows statistics header when collapsible', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} />);

      expect(screen.getByText('Statistics')).toBeInTheDocument();
    });

    it('shows summary in header when collapsible', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} />);

      expect(screen.getByText('12 bins, 25.5m filament')).toBeInTheDocument();
    });

    it('shows collapse/expand button when collapsible', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} />);

      expect(screen.getByLabelText('Hide statistics')).toBeInTheDocument();
    });

    it('starts collapsed when defaultCollapsed is true', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} defaultCollapsed={true} />);

      expect(screen.getByLabelText('Show statistics')).toBeInTheDocument();
      // Stats should not be visible when collapsed
      expect(screen.queryByTestId('stat-bin-types')).not.toBeInTheDocument();
    });

    it('shows stacked bar when collapsed', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} defaultCollapsed={true} />);

      expect(screen.getByTestId('category-stacked-bar')).toBeInTheDocument();
    });

    it('toggles collapse state on button click', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} defaultCollapsed={false} />);

      // Initially expanded
      expect(screen.getByLabelText('Hide statistics')).toBeInTheDocument();
      expect(screen.getByTestId('stat-bin-types')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByLabelText('Hide statistics'));

      // Now collapsed
      expect(screen.getByLabelText('Show statistics')).toBeInTheDocument();
      expect(screen.queryByTestId('stat-bin-types')).not.toBeInTheDocument();
    });

    it('expands when clicking expand button', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} defaultCollapsed={true} />);

      // Initially collapsed
      expect(screen.queryByTestId('stat-bin-types')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByLabelText('Show statistics'));

      // Now expanded
      expect(screen.getByTestId('stat-bin-types')).toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} defaultCollapsed={false} />);

      const button = screen.getByLabelText('Hide statistics');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has correct aria-expanded when collapsed', () => {
      render(<BinListDashboard {...defaultProps} collapsible={true} defaultCollapsed={true} />);

      const button = screen.getByLabelText('Show statistics');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('edge cases', () => {
    it('handles zero values', () => {
      render(
        <BinListDashboard
          {...defaultProps}
          totalBinTypes={0}
          totalBins={0}
          totalFilament={0}
          totalCost={0}
          totalPrintTimeHours={0}
        />
      );

      const binTypesStat = screen.getByTestId('stat-bin-types');
      expect(binTypesStat.querySelector('[data-testid="value"]')?.textContent).toBe('0');
    });

    it('handles very small print time', () => {
      render(<BinListDashboard {...defaultProps} totalPrintTimeHours={0.1} />);

      const printTimeStat = screen.getByTestId('stat-print-time');
      expect(printTimeStat.querySelector('[data-testid="value"]')?.textContent).toBe('6m');
    });

    it('handles large values', () => {
      render(
        <BinListDashboard
          {...defaultProps}
          totalBins={9999}
          totalFilament={1234.5}
          totalPrintTimeHours={99.5}
        />
      );

      const binsStat = screen.getByTestId('stat-total-bins');
      expect(binsStat.querySelector('[data-testid="value"]')?.textContent).toBe('9999');
    });
  });
});
