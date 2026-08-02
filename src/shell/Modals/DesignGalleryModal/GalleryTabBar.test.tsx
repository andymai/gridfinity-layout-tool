// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryTabBar } from './GalleryTabBar';

describe('GalleryTabBar', () => {
  it('renders both tabs with tablist semantics and roving tabIndex', () => {
    render(<GalleryTabBar activeTab="examples" onTabChange={vi.fn()} showNewDot={false} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(tablist).not.toHaveAttribute('tabindex');
    const examples = screen.getByRole('tab', { name: 'Examples' });
    const community = screen.getByRole('tab', { name: 'Community' });
    expect(examples).toHaveAttribute('aria-selected', 'true');
    expect(examples).toHaveAttribute('tabindex', '0');
    expect(examples).toHaveAttribute('aria-controls', 'gallery-tabpanel-examples');
    expect(community).toHaveAttribute('aria-selected', 'false');
    expect(community).toHaveAttribute('tabindex', '-1');
    expect(community).not.toHaveAttribute('aria-controls');
  });

  it('shows the new dot and conveys the new status to screen readers', () => {
    render(<GalleryTabBar activeTab="examples" onTabChange={vi.fn()} showNewDot />);
    expect(screen.getByTestId('community-new-dot')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('tab', { name: 'Community (New)' })).toBeInTheDocument();
  });

  it('hides the new dot when showNewDot is false', () => {
    render(<GalleryTabBar activeTab="examples" onTabChange={vi.fn()} showNewDot={false} />);
    expect(screen.queryByTestId('community-new-dot')).not.toBeInTheDocument();
  });

  it('clicking a tab notifies onTabChange', () => {
    const onTabChange = vi.fn();
    render(<GalleryTabBar activeTab="examples" onTabChange={onTabChange} showNewDot={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Community' }));
    expect(onTabChange).toHaveBeenCalledWith('community');
  });

  it('arrow keys move between tabs and wrap around', () => {
    const onTabChange = vi.fn();
    render(<GalleryTabBar activeTab="examples" onTabChange={onTabChange} showNewDot={false} />);
    const examplesTab = screen.getByRole('tab', { name: 'Examples' });

    fireEvent.keyDown(examplesTab, { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenLastCalledWith('community');
    expect(screen.getByRole('tab', { name: 'Community' })).toHaveFocus();

    fireEvent.keyDown(examplesTab, { key: 'ArrowLeft' });
    expect(onTabChange).toHaveBeenLastCalledWith('community');

    render(<GalleryTabBar activeTab="community" onTabChange={onTabChange} showNewDot={false} />);
    const secondCommunityTab = screen.getAllByRole('tab', { name: 'Community' })[1];
    fireEvent.keyDown(secondCommunityTab, { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenLastCalledWith('examples');
  });

  it('Home and End jump to the first and last tab', () => {
    const onTabChange = vi.fn();
    render(<GalleryTabBar activeTab="community" onTabChange={onTabChange} showNewDot={false} />);
    const communityTab = screen.getByRole('tab', { name: 'Community' });

    fireEvent.keyDown(communityTab, { key: 'Home' });
    expect(onTabChange).toHaveBeenLastCalledWith('examples');
    expect(screen.getByRole('tab', { name: 'Examples' })).toHaveFocus();

    fireEvent.keyDown(communityTab, { key: 'End' });
    expect(onTabChange).toHaveBeenLastCalledWith('community');
  });
});
