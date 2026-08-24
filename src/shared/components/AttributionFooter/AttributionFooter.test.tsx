import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect } from 'vitest';
import { AttributionFooter } from './AttributionFooter';
import { reloadSeenState } from '@/features/whats-new';
import { useViewStore } from '@/core/store/view';
import { resetAllStores } from '@/test/testUtils';

describe('AttributionFooter', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    reloadSeenState();
  });

  it('renders app name and a version button that opens What’s New', async () => {
    const user = userEvent.setup();
    render(<AttributionFooter />);
    expect(screen.getByText('Gridfinity Layout Tool')).toBeInTheDocument();

    // The version reaches GitHub Releases through the What's New footer now,
    // rather than linking straight out of the sidebar.
    const version = screen.getByRole('button', { name: /Open What/ });
    expect(version).toHaveTextContent(/v\d+\.\d+\.\d+/);
    expect(useViewStore.getState().whatsNewOpen).toBe(false);
    await user.click(version);
    expect(useViewStore.getState().whatsNewOpen).toBe(true);
  });

  it('badges the version while highlights are unseen', () => {
    localStorage.setItem(
      'gridfinity-whats-new-v1',
      JSON.stringify({ lastSeenId: 'an-older-entry', lastAutoOpenAt: 0 })
    );
    reloadSeenState();
    render(<AttributionFooter />);
    expect(screen.getByRole('button', { name: /Open What/ })).toHaveTextContent('New');
  });

  it('renders attribution links', () => {
    render(<AttributionFooter />);
    expect(screen.getByRole('link', { name: /Zack Freedman/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Andy Aragon/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Terms/ })).toBeInTheDocument();
  });

  it('opens all external links in a new tab', () => {
    render(<AttributionFooter />);
    // The Supporters link navigates within the SPA, so it is not an external new-tab link.
    const externalLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') !== '/supporters');
    externalLinks.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('navigates to the Supporters page in-app (no new tab)', () => {
    render(<AttributionFooter />);
    const supportersLink = screen.getByRole('link', { name: /Supporters/ });
    expect(supportersLink).toHaveAttribute('href', '/supporters');
    expect(supportersLink).not.toHaveAttribute('target');
  });
});
