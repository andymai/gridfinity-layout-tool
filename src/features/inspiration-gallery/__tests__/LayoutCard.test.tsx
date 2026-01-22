import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutCard } from '../components/LayoutCard';
import type { InspirationLayout } from '../types';

// Mock LayoutThumbnailWithLabels to avoid complex SVG rendering in tests
vi.mock('../components/LayoutThumbnailWithLabels', () => ({
  LayoutThumbnailWithLabels: ({ layout }: { layout: unknown }) => (
    <div data-testid="layout-thumbnail" data-layout={JSON.stringify(layout)} />
  ),
}));

const createMockLayout = (overrides: Partial<InspirationLayout> = {}): InspirationLayout => ({
  id: 'test-layout',
  name: 'Test Layout',
  theme: 'workshop',
  description: 'A detailed description of the test layout',
  shortDescription: 'A short description',
  complexity: 'beginner',
  features: [],
  metrics: {
    binCount: 12,
    layerCount: 2,
    categoryCount: 3,
    labeledBinCount: 8,
    drawerSize: { width: 10, depth: 8, height: 12 },
  },
  preview: {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 12,
    layerCount: 2,
    binMap: [],
  },
  layout: {
    name: 'Test',
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [],
    categories: [],
    bins: [],
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
  },
  tags: ['test'],
  ...overrides,
});

describe('LayoutCard', () => {
  const defaultProps = {
    layout: createMockLayout(),
    onClick: vi.fn(),
    index: 0,
  };

  describe('rendering', () => {
    it('renders the layout name', () => {
      render(<LayoutCard {...defaultProps} />);

      expect(screen.getByText('Test Layout')).toBeInTheDocument();
    });

    it('renders the short description', () => {
      render(<LayoutCard {...defaultProps} />);

      expect(screen.getByText('A short description')).toBeInTheDocument();
    });

    it('renders bin count and drawer size', () => {
      render(<LayoutCard {...defaultProps} />);

      expect(screen.getByText('12 bins · 10×8')).toBeInTheDocument();
    });

    it('renders theme badge', () => {
      render(<LayoutCard {...defaultProps} />);

      expect(screen.getByText('Workshop')).toBeInTheDocument();
    });

    it('renders thumbnail component', () => {
      render(<LayoutCard {...defaultProps} />);

      expect(screen.getByTestId('layout-thumbnail')).toBeInTheDocument();
    });

    it('renders different theme labels correctly', () => {
      const themes = [
        { theme: 'kitchen', label: 'Kitchen' },
        { theme: 'workshop', label: 'Workshop' },
        { theme: 'office', label: 'Office' },
        { theme: 'hobby', label: 'Hobby' },
        { theme: 'personal', label: 'Personal' },
      ] as const;

      themes.forEach(({ theme, label }) => {
        const { unmount } = render(
          <LayoutCard {...defaultProps} layout={createMockLayout({ theme })} />
        );

        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('animation', () => {
    it('applies animation delay based on index', () => {
      render(<LayoutCard {...defaultProps} index={2} />);

      const card = screen.getByRole('button');
      expect(card).toHaveStyle({ animationDelay: '100ms' });
    });

    it('caps animation delay at 300ms', () => {
      render(<LayoutCard {...defaultProps} index={10} />);

      const card = screen.getByRole('button');
      expect(card).toHaveStyle({ animationDelay: '300ms' });
    });

    it('applies 0ms delay for first card', () => {
      render(<LayoutCard {...defaultProps} index={0} />);

      const card = screen.getByRole('button');
      expect(card).toHaveStyle({ animationDelay: '0ms' });
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<LayoutCard {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Enter key is pressed', () => {
      const onClick = vi.fn();
      render(<LayoutCard {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', () => {
      const onClick = vi.fn();
      render(<LayoutCard {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick for other keys', () => {
      const onClick = vi.fn();
      render(<LayoutCard {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
      fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });

      expect(onClick).not.toHaveBeenCalled();
    });

    it('calls onFocus when focused', () => {
      const onFocus = vi.fn();
      render(<LayoutCard {...defaultProps} onFocus={onFocus} />);

      fireEvent.focus(screen.getByRole('button'));

      expect(onFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has button role', () => {
      render(<LayoutCard {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has descriptive aria-label', () => {
      render(<LayoutCard {...defaultProps} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute(
        'aria-label',
        'Test Layout. Workshop. 12 bins. A short description'
      );
    });

    it('uses custom tabIndex when provided', () => {
      render(<LayoutCard {...defaultProps} tabIndex={-1} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '-1');
    });

    it('uses default tabIndex of 0', () => {
      render(<LayoutCard {...defaultProps} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('has data-layout-card attribute for query selection', () => {
      render(<LayoutCard {...defaultProps} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('data-layout-card');
    });
  });

  describe('metrics display', () => {
    it('displays correct metrics for different layouts', () => {
      const layout = createMockLayout({
        metrics: {
          binCount: 25,
          layerCount: 3,
          categoryCount: 5,
          labeledBinCount: 20,
          drawerSize: { width: 15, depth: 12, height: 18 },
        },
      });

      render(<LayoutCard {...defaultProps} layout={layout} />);

      expect(screen.getByText('25 bins · 15×12')).toBeInTheDocument();
    });

    it('handles single bin count', () => {
      const layout = createMockLayout({
        metrics: {
          ...createMockLayout().metrics,
          binCount: 1,
        },
      });

      render(<LayoutCard {...defaultProps} layout={layout} />);

      expect(screen.getByText('1 bins · 10×8')).toBeInTheDocument();
    });
  });
});
