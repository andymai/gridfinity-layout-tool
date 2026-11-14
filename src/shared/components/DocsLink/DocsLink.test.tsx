import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocsLink } from './DocsLink';

describe('DocsLink', () => {
  it('opens the unslashed docs path in a new tab', () => {
    render(<DocsLink label="Docs" />);
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('href', '/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('takes its name from the label when no aria label is given', () => {
    render(<DocsLink label="Read the docs" />);
    const link = screen.getByRole('link', { name: 'Read the docs' });
    expect(link).not.toHaveAttribute('title');
    expect(link).not.toHaveAttribute('aria-label');
  });

  it('uses the aria label as its name and hover hint, and still shows the label', () => {
    render(<DocsLink label="Docs" ariaLabel="Open the docs" />);
    const link = screen.getByRole('link', { name: 'Open the docs' });
    expect(link).toHaveAttribute('title', 'Open the docs');
    expect(link).toHaveTextContent('Docs');
  });

  it('hides the label by breakpoint while the accessible name stays', () => {
    render(<DocsLink label="Docs" ariaLabel="Open the docs" labelClassName="hidden 2xl:inline" />);
    expect(screen.getByRole('link', { name: 'Open the docs' })).toBeInTheDocument();
    expect(screen.getByText('Docs')).toHaveClass('hidden', '2xl:inline');
  });

  it('adds the caller class to the link, letting it override the display', () => {
    render(<DocsLink label="Docs" className="ml-auto hidden 2xl:inline-flex" />);
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveClass('ml-auto', 'h-8', 'hidden', '2xl:inline-flex');
    expect(link).not.toHaveClass('inline-flex');
  });
});
