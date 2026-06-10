import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AttributionFooter } from './AttributionFooter';

describe('AttributionFooter', () => {
  it('renders app name and version link', () => {
    render(<AttributionFooter />);
    expect(screen.getByText('Gridfinity Layout Tool')).toBeInTheDocument();
    const versionLink = screen.getByRole('link', { name: /v\d+\.\d+\.\d+/ });
    expect(versionLink).toHaveAttribute('href', expect.stringContaining('releases/tag/'));
  });

  it('renders attribution links', () => {
    render(<AttributionFooter />);
    expect(screen.getByRole('link', { name: /Zack Freedman/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Andy Aragon/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GitHub/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Terms/ })).toBeInTheDocument();
  });

  it('opens all external links in a new tab', () => {
    render(<AttributionFooter />);
    const externalLinks = screen.getAllByRole('link');
    externalLinks.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
