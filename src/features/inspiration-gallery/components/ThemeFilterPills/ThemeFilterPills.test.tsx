import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeFilterPills } from '.';
import type { InspirationTheme } from '../../types';

describe('ThemeFilterPills', () => {
  const defaultThemeCounts: Record<InspirationTheme | 'all', number> = {
    all: 23,
    kitchen: 4,
    workshop: 7,
    office: 2,
    hobby: 5,
    personal: 5,
  };

  const defaultProps = {
    selectedTheme: 'all' as const,
    onThemeChange: vi.fn(),
    themeCounts: defaultThemeCounts,
  };

  describe('rendering', () => {
    it('renders all 6 filter buttons', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(6);
    });

    it('renders "All" label for all theme', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    });

    it('renders correct labels for each theme', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /kitchen/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /workshop/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /office/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /hobby/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /personal/i })).toBeInTheDocument();
    });

    it('displays count badges for each theme', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      // The counts should be visible in the document
      expect(screen.getByText('23')).toBeInTheDocument(); // all
      expect(screen.getByText('4')).toBeInTheDocument(); // kitchen
      expect(screen.getByText('7')).toBeInTheDocument(); // workshop
      expect(screen.getByText('2')).toBeInTheDocument(); // office
      // Note: 5 appears twice (hobby and personal), so we just check it exists
      expect(screen.getAllByText('5')).toHaveLength(2);
    });

    it('renders theme icons for non-all themes', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      // Each theme button should contain an SVG icon
      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        const svg = tab.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  describe('selected state', () => {
    it('marks "all" as selected by default', () => {
      render(<ThemeFilterPills {...defaultProps} selectedTheme="all" />);

      const allTab = screen.getByRole('tab', { name: /all.*23/i });
      expect(allTab).toHaveAttribute('aria-selected', 'true');
    });

    it('marks selected theme with aria-selected=true', () => {
      render(<ThemeFilterPills {...defaultProps} selectedTheme="workshop" />);

      const workshopTab = screen.getByRole('tab', { name: /workshop/i });
      expect(workshopTab).toHaveAttribute('aria-selected', 'true');

      const allTab = screen.getByRole('tab', { name: /all/i });
      expect(allTab).toHaveAttribute('aria-selected', 'false');
    });

    it('only one theme can be selected at a time', () => {
      render(<ThemeFilterPills {...defaultProps} selectedTheme="kitchen" />);

      const tabs = screen.getAllByRole('tab');
      const selectedTabs = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');

      expect(selectedTabs).toHaveLength(1);
    });
  });

  describe('interactions', () => {
    it('calls onThemeChange when a theme is clicked', () => {
      const onThemeChange = vi.fn();
      render(<ThemeFilterPills {...defaultProps} onThemeChange={onThemeChange} />);

      fireEvent.click(screen.getByRole('tab', { name: /workshop/i }));

      expect(onThemeChange).toHaveBeenCalledTimes(1);
      expect(onThemeChange).toHaveBeenCalledWith('workshop');
    });

    it('calls onThemeChange with "all" when All is clicked', () => {
      const onThemeChange = vi.fn();
      render(
        <ThemeFilterPills {...defaultProps} selectedTheme="kitchen" onThemeChange={onThemeChange} />
      );

      fireEvent.click(screen.getByRole('tab', { name: /all/i }));

      expect(onThemeChange).toHaveBeenCalledWith('all');
    });

    it('calls onThemeChange with each theme type', () => {
      const onThemeChange = vi.fn();
      render(<ThemeFilterPills {...defaultProps} onThemeChange={onThemeChange} />);

      const themes: Array<InspirationTheme | 'all'> = [
        'kitchen',
        'workshop',
        'office',
        'hobby',
        'personal',
      ];

      themes.forEach((theme) => {
        onThemeChange.mockClear();
        fireEvent.click(screen.getByRole('tab', { name: new RegExp(theme, 'i') }));
        expect(onThemeChange).toHaveBeenCalledWith(theme);
      });
    });
  });

  describe('accessibility', () => {
    it('has tablist role on container', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('has aria-label on tablist', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Filter by theme');
    });

    it('all buttons have tab role', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(6);
    });

    it('all buttons are of type button', () => {
      render(<ThemeFilterPills {...defaultProps} />);

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('count updates', () => {
    it('displays updated counts when themeCounts change', () => {
      const { rerender } = render(<ThemeFilterPills {...defaultProps} />);

      expect(screen.getByText('23')).toBeInTheDocument();

      const updatedCounts = {
        ...defaultThemeCounts,
        all: 30,
        workshop: 10,
      };

      rerender(<ThemeFilterPills {...defaultProps} themeCounts={updatedCounts} />);

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('handles zero counts', () => {
      const zeroCounts: Record<InspirationTheme | 'all', number> = {
        all: 0,
        kitchen: 0,
        workshop: 0,
        office: 0,
        hobby: 0,
        personal: 0,
      };

      render(<ThemeFilterPills {...defaultProps} themeCounts={zeroCounts} />);

      const zeroElements = screen.getAllByText('0');
      expect(zeroElements).toHaveLength(6);
    });
  });
});
