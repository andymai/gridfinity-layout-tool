import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CategoryBreakdownChart,
  CategoryStackedBar,
  CategoryLegend,
} from '@/components/BinList/CategoryBreakdownChart';
import type { CategoryBreakdown } from '@/utils/binListOperations';

describe('CategoryBreakdownChart', () => {
  const createBreakdown = (
    id: string,
    name: string,
    color: string,
    percentage: number
  ): CategoryBreakdown => ({
    categoryId: id,
    categoryName: name,
    categoryColor: color,
    filament: percentage * 2, // Arbitrary
    cost: percentage * 0.1,
    binCount: Math.ceil(percentage / 10),
    percentage,
  });

  const sampleBreakdown: CategoryBreakdown[] = [
    createBreakdown('coral', 'Coral', '#FF6B6B', 50),
    createBreakdown('sky', 'Sky', '#38bdf8', 30),
    createBreakdown('green', 'Green', '#22c55e', 20),
  ];

  describe('rendering', () => {
    it('displays category names when showLabels is true', () => {
      render(<CategoryBreakdownChart breakdown={sampleBreakdown} />);

      expect(screen.getByText('Coral')).toBeInTheDocument();
      expect(screen.getByText('Sky')).toBeInTheDocument();
      expect(screen.getByText('Green')).toBeInTheDocument();
    });

    it('hides category names when showLabels is false', () => {
      render(<CategoryBreakdownChart breakdown={sampleBreakdown} showLabels={false} />);

      expect(screen.queryByText('Coral')).not.toBeInTheDocument();
    });

    it('displays percentages', () => {
      render(<CategoryBreakdownChart breakdown={sampleBreakdown} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('shows empty state when no data', () => {
      render(<CategoryBreakdownChart breakdown={[]} />);

      expect(screen.getByText('No data to display')).toBeInTheDocument();
    });

    it('renders bars with category colors', () => {
      const { container } = render(<CategoryBreakdownChart breakdown={sampleBreakdown} />);

      const bars = container.querySelectorAll('[style*="background-color"]');
      expect(bars.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('maxCategories limit', () => {
    const manyCategories: CategoryBreakdown[] = [
      createBreakdown('cat1', 'Category 1', '#FF0000', 25),
      createBreakdown('cat2', 'Category 2', '#00FF00', 20),
      createBreakdown('cat3', 'Category 3', '#0000FF', 15),
      createBreakdown('cat4', 'Category 4', '#FFFF00', 15),
      createBreakdown('cat5', 'Category 5', '#FF00FF', 10),
      createBreakdown('cat6', 'Category 6', '#00FFFF', 8),
      createBreakdown('cat7', 'Category 7', '#FFA500', 4),
      createBreakdown('cat8', 'Category 8', '#800080', 3),
    ];

    it('limits displayed categories to maxCategories', () => {
      render(<CategoryBreakdownChart breakdown={manyCategories} maxCategories={6} />);

      // Should show 5 individual categories + "Other"
      expect(screen.getByText('Category 1')).toBeInTheDocument();
      expect(screen.getByText(/Other/)).toBeInTheDocument();
    });

    it('groups remaining categories as "Other"', () => {
      render(<CategoryBreakdownChart breakdown={manyCategories} maxCategories={4} />);

      // Other should show count of grouped categories
      expect(screen.getByText(/Other \(\d+\)/)).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('applies compact styles', () => {
      const { container } = render(
        <CategoryBreakdownChart breakdown={sampleBreakdown} compact />
      );

      // Compact mode uses smaller heights and fonts
      const bars = container.querySelectorAll('.h-5');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe('tooltips', () => {
    it('includes tooltip with details', () => {
      const { container } = render(<CategoryBreakdownChart breakdown={sampleBreakdown} />);

      const row = container.querySelector('[title*="Coral"]');
      expect(row).toBeInTheDocument();
      expect(row?.getAttribute('title')).toContain('50%');
    });
  });
});

describe('CategoryStackedBar', () => {
  const sampleBreakdown: CategoryBreakdown[] = [
    {
      categoryId: 'coral',
      categoryName: 'Coral',
      categoryColor: '#FF6B6B',
      filament: 100,
      cost: 5,
      binCount: 10,
      percentage: 50,
    },
    {
      categoryId: 'sky',
      categoryName: 'Sky',
      categoryColor: '#38bdf8',
      filament: 100,
      cost: 5,
      binCount: 10,
      percentage: 50,
    },
  ];

  it('renders stacked segments', () => {
    const { container } = render(<CategoryStackedBar breakdown={sampleBreakdown} />);

    const segments = container.querySelectorAll('[style*="width: 50%"]');
    expect(segments).toHaveLength(2);
  });

  it('renders empty bar when no data', () => {
    const { container } = render(<CategoryStackedBar breakdown={[]} />);

    expect(container.querySelector('.bg-surface')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    const { container } = render(
      <CategoryStackedBar breakdown={sampleBreakdown} height="h-8" />
    );

    expect(container.querySelector('.h-8')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    render(<CategoryStackedBar breakdown={sampleBreakdown} />);

    expect(screen.getByRole('img', { name: 'Category breakdown' })).toBeInTheDocument();
  });

  it('includes tooltips on segments', () => {
    const { container } = render(<CategoryStackedBar breakdown={sampleBreakdown} />);

    const segment = container.querySelector('[title*="Coral"]');
    expect(segment).toBeInTheDocument();
    expect(segment?.getAttribute('title')).toContain('50%');
  });
});

describe('CategoryLegend', () => {
  const sampleBreakdown: CategoryBreakdown[] = [
    {
      categoryId: 'coral',
      categoryName: 'Coral',
      categoryColor: '#FF6B6B',
      filament: 100,
      cost: 5,
      binCount: 10,
      percentage: 50,
    },
    {
      categoryId: 'sky',
      categoryName: 'Sky',
      categoryColor: '#38bdf8',
      filament: 100,
      cost: 5,
      binCount: 10,
      percentage: 50,
    },
  ];

  it('renders category names', () => {
    render(<CategoryLegend breakdown={sampleBreakdown} />);

    expect(screen.getByText('Coral')).toBeInTheDocument();
    expect(screen.getByText('Sky')).toBeInTheDocument();
  });

  it('renders color dots', () => {
    const { container } = render(<CategoryLegend breakdown={sampleBreakdown} />);

    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(2);
  });

  it('applies compact styles', () => {
    const { container } = render(<CategoryLegend breakdown={sampleBreakdown} compact />);

    // Compact mode uses smaller dot size
    expect(container.querySelector('.w-2\\.5')).toBeInTheDocument();
  });
});
