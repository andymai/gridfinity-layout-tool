import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplitWarning } from '../../features/bin-inspector';

describe('SplitWarning', () => {
  const defaultProps = {
    binWidth: 2,
    binDepth: 2,
    maxGridUnits: 6,
    gridUnitMm: 42,
    printBedSize: 256,
  };

  describe('when bin fits print bed', () => {
    it('shows success state', () => {
      render(<SplitWarning {...defaultProps} />);

      expect(screen.getByText(/Fits print bed/)).toBeInTheDocument();
      expect(screen.getByText(/2×2 ≤ 6×6/)).toBeInTheDocument();
    });

    it('shows success checkmark icon', () => {
      const { container } = render(<SplitWarning {...defaultProps} />);

      // Check for success-colored SVG
      const svg = container.querySelector('svg.text-success');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('when bin exceeds print bed', () => {
    const oversizedProps = {
      ...defaultProps,
      binWidth: 8,
      binDepth: 4,
    };

    it('shows warning state', () => {
      render(<SplitWarning {...oversizedProps} />);

      expect(screen.getByText(/Exceeds print bed/)).toBeInTheDocument();
    });

    it('calculates pieces correctly for width overflow', () => {
      render(<SplitWarning {...oversizedProps} />);

      // 8 width / 6 max = 2 pieces wide, 4 depth / 6 max = 1 piece deep
      // Total: 2 * 1 = 2 pieces
      expect(screen.getByText(/2 pieces/)).toBeInTheDocument();
    });

    it('calculates pieces correctly for both dimensions overflow', () => {
      render(
        <SplitWarning
          {...defaultProps}
          binWidth={12}
          binDepth={10}
        />
      );

      // 12 width / 6 max = 2 pieces wide, 10 depth / 6 max = 2 pieces deep
      // Total: 2 * 2 = 4 pieces
      expect(screen.getByText(/4 pieces/)).toBeInTheDocument();
    });

    it('shows max piece size info', () => {
      render(<SplitWarning {...oversizedProps} />);

      expect(screen.getByText(/max 6×6 per piece/)).toBeInTheDocument();
    });

    it('renders print bed indicator with correct title', () => {
      const { container } = render(<SplitWarning {...oversizedProps} />);

      const indicator = container.querySelector('[title*="Print bed"]');
      expect(indicator).toBeInTheDocument();
      expect(indicator?.getAttribute('title')).toContain('256×256mm');
    });
  });

  describe('compact mode', () => {
    const oversizedProps = {
      ...defaultProps,
      binWidth: 8,
      binDepth: 4,
      compact: true,
    };

    it('shows simplified warning in compact mode', () => {
      render(<SplitWarning {...oversizedProps} />);

      expect(screen.getByText(/Will be split into 2 pieces for printing/)).toBeInTheDocument();
    });

    it('does not show detailed explanation in compact mode', () => {
      render(<SplitWarning {...oversizedProps} />);

      expect(screen.queryByText(/Exceeds print bed/)).not.toBeInTheDocument();
      expect(screen.queryByText(/max.*per piece/)).not.toBeInTheDocument();
    });

    it('does not render print bed indicator in compact mode', () => {
      const { container } = render(<SplitWarning {...oversizedProps} />);

      const indicator = container.querySelector('[title*="Print bed"]');
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles exact max size (no split needed)', () => {
      render(
        <SplitWarning
          {...defaultProps}
          binWidth={6}
          binDepth={6}
        />
      );

      expect(screen.getByText(/Fits print bed/)).toBeInTheDocument();
    });

    it('handles one unit over max', () => {
      render(
        <SplitWarning
          {...defaultProps}
          binWidth={7}
          binDepth={6}
        />
      );

      // 7 / 6 = 2 pieces wide, 6 / 6 = 1 piece deep = 2 pieces
      expect(screen.getByText(/2 pieces/)).toBeInTheDocument();
    });

    it('handles fractional dimensions', () => {
      render(
        <SplitWarning
          {...defaultProps}
          binWidth={6.5}
          binDepth={3}
        />
      );

      // 6.5 > 6 so needs split
      expect(screen.getByText(/Exceeds print bed/)).toBeInTheDocument();
    });

    it('handles different grid unit sizes', () => {
      render(
        <SplitWarning
          {...defaultProps}
          gridUnitMm={50}
          maxGridUnits={5}
          binWidth={6}
          binDepth={3}
        />
      );

      // 6 > 5 max, so needs split
      expect(screen.getByText(/2 pieces/)).toBeInTheDocument();
    });
  });
});
