import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabNavigation } from './TabNavigation';

// Mock useResponsive to control mobile/desktop rendering
const mockUseResponsive = vi.fn();
vi.mock('@/shared/hooks', () => ({
  useResponsive: () => mockUseResponsive(),
}));

// Mock useTranslation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('TabNavigation', () => {
  const onTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('desktop (vertical sidebar)', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isMobile: false });
    });

    it('renders all 8 tabs with vertical orientation', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-orientation', 'vertical');
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(8);
    });

    it('marks the active tab with aria-selected', () => {
      render(<TabNavigation activeTab="privacy" onTabChange={onTabChange} />);
      const tabs = screen.getAllByRole('tab');
      const privacyTab = tabs.find((tab) => tab.textContent === 'settings.tabs.privacy');
      expect(privacyTab).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onTabChange when a tab is clicked', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      const tabs = screen.getAllByRole('tab');
      fireEvent.click(tabs[4]); // integrations tab (after account was inserted at index 2)
      expect(onTabChange).toHaveBeenCalledWith('integrations');
    });

    it('supports arrow key navigation (down/up)', () => {
      render(<TabNavigation activeTab="general" onTabChange={onTabChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowDown' });
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
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(8);
    });

    it('supports arrow key navigation (left/right)', () => {
      render(<TabNavigation activeTab="defaults" onTabChange={onTabChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onTabChange).toHaveBeenCalledWith('integrations');
    });

    it('wraps around from last to first tab', () => {
      render(<TabNavigation activeTab="labs" onTabChange={onTabChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onTabChange).toHaveBeenCalledWith('general');
    });
  });
});
