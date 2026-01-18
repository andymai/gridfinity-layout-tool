import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  StatCard,
  BinIcon,
  FilamentIcon,
  CostIcon,
  TimeIcon,
  SpoolIcon,
  CategoryBreakdownChart,
  CategoryStackedBar,
  CategoryLegend,
} from '@/components/BinList';
import type { CategoryBreakdown } from '@/utils/binListOperations';

describe('StatCard', () => {
  const defaultIcon = <span data-testid="test-icon">Icon</span>;

  it('renders icon, label, and value', () => {
    render(
      <StatCard
        icon={defaultIcon}
        label="Total Bins"
        value={42}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Total Bins')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders unit when provided', () => {
    render(
      <StatCard
        icon={defaultIcon}
        label="Filament"
        value={15.5}
        unit="m"
      />
    );

    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('renders title attribute when provided', () => {
    const { container } = render(
      <StatCard
        icon={defaultIcon}
        label="Cost"
        value="$3.50"
        title="Estimated cost based on $25/kg"
      />
    );

    const card = container.querySelector('[title="Estimated cost based on $25/kg"]');
    expect(card).toBeInTheDocument();
  });

  it('applies default variant styling', () => {
    const { container } = render(
      <StatCard
        icon={defaultIcon}
        label="Test"
        value="100"
      />
    );

    const iconContainer = container.querySelector('.text-content-secondary');
    expect(iconContainer).toBeInTheDocument();
  });

  it('applies success variant styling', () => {
    const { container } = render(
      <StatCard
        icon={defaultIcon}
        label="Test"
        value="100"
        variant="success"
      />
    );

    const iconContainer = container.querySelector('[class*="text-[var(--color-success)]"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it('applies warning variant styling', () => {
    const { container } = render(
      <StatCard
        icon={defaultIcon}
        label="Test"
        value="100"
        variant="warning"
      />
    );

    const iconContainer = container.querySelector('[class*="text-[var(--color-warning)]"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it('applies info variant styling', () => {
    const { container } = render(
      <StatCard
        icon={defaultIcon}
        label="Test"
        value="100"
        variant="info"
      />
    );

    const iconContainer = container.querySelector('[class*="text-[var(--color-info)]"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it('renders string values correctly', () => {
    render(
      <StatCard
        icon={defaultIcon}
        label="Time"
        value="2h 30m"
      />
    );

    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });
});

describe('Icon components', () => {
  describe('BinIcon', () => {
    it('renders with default class', () => {
      const { container } = render(<BinIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('renders with custom class', () => {
      const { container } = render(<BinIcon className="w-8 h-8" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-8', 'h-8');
    });
  });

  describe('FilamentIcon', () => {
    it('renders with default class', () => {
      const { container } = render(<FilamentIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('renders with custom class', () => {
      const { container } = render(<FilamentIcon className="w-6 h-6" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6', 'h-6');
    });
  });

  describe('CostIcon', () => {
    it('renders with default class', () => {
      const { container } = render(<CostIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('renders with custom class', () => {
      const { container } = render(<CostIcon className="w-4 h-4" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-4', 'h-4');
    });
  });

  describe('TimeIcon', () => {
    it('renders with default class', () => {
      const { container } = render(<TimeIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('renders with custom class', () => {
      const { container } = render(<TimeIcon className="w-3 h-3" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-3', 'h-3');
    });
  });

  describe('SpoolIcon', () => {
    it('renders with default class', () => {
      const { container } = render(<SpoolIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('renders with custom class', () => {
      const { container } = render(<SpoolIcon className="w-10 h-10" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-10', 'h-10');
    });
  });
});

describe('CategoryBreakdownChart', () => {
  const mockBreakdown: CategoryBreakdown[] = [
    {
      categoryId: 'coral',
      categoryName: 'Coral',
      categoryColor: '#FF6B6B',
      filament: 10.5,
      cost: 0.8,
      binCount: 5,
      percentage: 50,
    },
    {
      categoryId: 'blue',
      categoryName: 'Blue',
      categoryColor: '#4ECDC4',
      filament: 10.5,
      cost: 0.8,
      binCount: 5,
      percentage: 50,
    },
  ];

  it('renders empty message when no data', () => {
    render(<CategoryBreakdownChart breakdown={[]} />);

    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });

  it('renders category bars', () => {
    render(<CategoryBreakdownChart breakdown={mockBreakdown} />);

    expect(screen.getByText('Coral')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getAllByText('50%')).toHaveLength(2);
  });

  it('shows labels by default', () => {
    render(<CategoryBreakdownChart breakdown={mockBreakdown} />);

    expect(screen.getByText('Coral')).toBeInTheDocument();
  });

  it('hides labels when showLabels is false', () => {
    render(<CategoryBreakdownChart breakdown={mockBreakdown} showLabels={false} />);

    expect(screen.queryByText('Coral')).not.toBeInTheDocument();
    expect(screen.queryByText('Blue')).not.toBeInTheDocument();
    // Percentages should still show
    expect(screen.getAllByText('50%')).toHaveLength(2);
  });

  it('applies bar colors from category data', () => {
    const { container } = render(<CategoryBreakdownChart breakdown={mockBreakdown} />);

    // Style uses kebab-case in DOM
    const bars = container.querySelectorAll('[style*="background-color"]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('groups excess categories as "Other" when exceeding maxCategories', () => {
    const manyCategories: CategoryBreakdown[] = Array(10).fill(null).map((_, i) => ({
      categoryId: `cat${i}`,
      categoryName: `Category ${i}`,
      categoryColor: `#${i}${i}${i}${i}${i}${i}`,
      filament: 2.1,
      cost: 0.16,
      binCount: 1,
      percentage: 10,
    }));

    render(<CategoryBreakdownChart breakdown={manyCategories} maxCategories={6} />);

    // Should show "Other (5)" since 10 categories with max 6 means 5 + 1 other = 6 rows
    expect(screen.getByText(/Other \(\d+\)/)).toBeInTheDocument();
  });

  it('applies compact mode styling', () => {
    const { container } = render(
      <CategoryBreakdownChart breakdown={mockBreakdown} compact={true} />
    );

    const compactBars = container.querySelectorAll('.h-5');
    expect(compactBars.length).toBeGreaterThan(0);
  });

  it('applies normal mode styling', () => {
    const { container } = render(
      <CategoryBreakdownChart breakdown={mockBreakdown} compact={false} />
    );

    const normalBars = container.querySelectorAll('.h-6');
    expect(normalBars.length).toBeGreaterThan(0);
  });

  it('includes title attribute with full details', () => {
    const { container } = render(<CategoryBreakdownChart breakdown={mockBreakdown} />);

    const rowWithTitle = container.querySelector('[title="Coral: 10.5m (50%)"]');
    expect(rowWithTitle).toBeInTheDocument();
  });
});

describe('CategoryStackedBar', () => {
  const mockBreakdown: CategoryBreakdown[] = [
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

  it('renders empty bar when no data', () => {
    const { container } = render(<CategoryStackedBar breakdown={[]} />);

    const bar = container.querySelector('.bg-surface');
    expect(bar).toBeInTheDocument();
  });

  it('renders stacked segments', () => {
    const { container } = render(<CategoryStackedBar breakdown={mockBreakdown} />);

    const segments = container.querySelectorAll('[style*="width"]');
    expect(segments.length).toBe(2);
  });

  it('applies custom height', () => {
    const { container } = render(
      <CategoryStackedBar breakdown={mockBreakdown} height="h-8" />
    );

    const bar = container.querySelector('.h-8');
    expect(bar).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<CategoryStackedBar breakdown={mockBreakdown} />);

    expect(screen.getByRole('img', { name: 'Category breakdown' })).toBeInTheDocument();
  });

  it('includes tooltips for each segment', () => {
    const { container } = render(<CategoryStackedBar breakdown={mockBreakdown} />);

    const coralSegment = container.querySelector('[title="Coral: 60%"]');
    const blueSegment = container.querySelector('[title="Blue: 40%"]');

    expect(coralSegment).toBeInTheDocument();
    expect(blueSegment).toBeInTheDocument();
  });

  it('applies segment colors from category data', () => {
    const { container } = render(<CategoryStackedBar breakdown={mockBreakdown} />);

    const coralSegment = container.querySelector('[style*="background-color: rgb(255, 107, 107)"]');
    const blueSegment = container.querySelector('[style*="background-color: rgb(78, 205, 196)"]');

    expect(coralSegment).toBeInTheDocument();
    expect(blueSegment).toBeInTheDocument();
  });
});

describe('CategoryLegend', () => {
  const mockBreakdown: CategoryBreakdown[] = [
    {
      categoryId: 'coral',
      categoryName: 'Coral',
      categoryColor: '#FF6B6B',
      filament: 10,
      cost: 0.76,
      binCount: 5,
      percentage: 50,
    },
    {
      categoryId: 'blue',
      categoryName: 'Blue',
      categoryColor: '#4ECDC4',
      filament: 10,
      cost: 0.76,
      binCount: 5,
      percentage: 50,
    },
  ];

  it('renders category names', () => {
    render(<CategoryLegend breakdown={mockBreakdown} />);

    expect(screen.getByText('Coral')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('renders color dots', () => {
    const { container } = render(<CategoryLegend breakdown={mockBreakdown} />);

    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(2);
  });

  it('applies compact mode styling', () => {
    const { container } = render(
      <CategoryLegend breakdown={mockBreakdown} compact={true} />
    );

    const compactDots = container.querySelectorAll('.w-2\\.5.h-2\\.5');
    expect(compactDots.length).toBe(2);
  });

  it('applies normal mode styling', () => {
    const { container } = render(
      <CategoryLegend breakdown={mockBreakdown} compact={false} />
    );

    const normalDots = container.querySelectorAll('.w-3.h-3');
    expect(normalDots.length).toBe(2);
  });

  it('renders empty when no categories', () => {
    const { container } = render(<CategoryLegend breakdown={[]} />);

    // Should render an empty flex container
    const wrapper = container.querySelector('.flex.flex-wrap');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.children.length).toBe(0);
  });

  it('applies category colors to dots', () => {
    const { container } = render(<CategoryLegend breakdown={mockBreakdown} />);

    const coralDot = container.querySelector('[style*="background-color: rgb(255, 107, 107)"]');
    const blueDot = container.querySelector('[style*="background-color: rgb(78, 205, 196)"]');

    expect(coralDot).toBeInTheDocument();
    expect(blueDot).toBeInTheDocument();
  });
});
