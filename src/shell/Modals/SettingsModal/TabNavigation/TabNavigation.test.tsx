import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabNavigation } from './TabNavigation';
import { TAB_DEFINITIONS } from '../tabDefinitions';

// Mock useResponsive to control mobile/desktop rendering
const mockUseResponsive = vi.fn();
vi.mock('@/shared/hooks', () => ({
  useResponsive: () => mockUseResponsive(),
}));

// Mock useTranslation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Derive from the source of truth so adding/removing a tab doesn't require a
// manual bump here (tabDefinitions.test.ts asserts the exact expected set).
const TAB_COUNT = TAB_DEFINITIONS.length;

describe('TabNavigation', () => {
  const onTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('desktop (vertical sidebar)', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isMobile: false });
    });

    it('renders every tab with vertical orientation', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-orientation', 'vertical');
      expect(screen.getAllByRole('tab')).toHaveLength(TAB_COUNT);
    });

    it('renders sidebar group headers', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      expect(screen.getByText('settings.groups.preferences')).toBeInTheDocument();
      expect(screen.getByText('settings.groups.defaults')).toBeInTheDocument();
      expect(screen.getByText('settings.groups.data')).toBeInTheDocument();
      expect(screen.getByText('settings.groups.advanced')).toBeInTheDocument();
    });

    it('marks the active tab with aria-selected', () => {
      render(<TabNavigation activeTab="privacy" onTabChange={onTabChange} />);
      const privacyTab = screen
        .getAllByRole('tab')
        .find((tab) => tab.textContent === 'settings.tabs.privacy');
      expect(privacyTab).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onTabChange when a tab is clicked', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      const printTab = screen
        .getAllByRole('tab')
        .find((tab) => tab.textContent === 'settings.tabs.print');
      fireEvent.click(printTab!);
      expect(onTabChange).toHaveBeenCalledWith('print');
    });

    it('supports arrow key navigation (down/up)', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowDown' });
      expect(onTabChange).toHaveBeenCalledWith('appearance');
    });
  });

  describe('mobile (horizontal bar)', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isMobile: true });
    });

    it('renders horizontal tab bar without vertical orientation', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).not.toHaveAttribute('aria-orientation');
      expect(screen.getAllByRole('tab')).toHaveLength(TAB_COUNT);
    });

    it('supports arrow key navigation (left/right)', () => {
      render(<TabNavigation activeTab="defaults" onTabChange={onTabChange} />);
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
      expect(onTabChange).toHaveBeenCalledWith('print');
    });

    it('wraps around from last to first tab', () => {
      render(<TabNavigation activeTab="labs" onTabChange={onTabChange} />);
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
      expect(onTabChange).toHaveBeenCalledWith('general');
    });
  });
});
