import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AttributionFooter } from './AttributionFooter';

describe('AttributionFooter', () => {
  it('renders app name and version link', () => {
    render(<AttributionFooter />);
    expect(screen.getByText('Gridfinity Layout Tool')).toBeInTheDocument();
    const versionLink = screen.getByRole('link', { name: /v\d+\.\d+\.\d+/ });
    expect(versionLink).toHaveAttribute(
      'href',
      'https://github.com/andymai/gridfinity-layout-tool/releases'
    );
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
