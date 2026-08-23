import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SchemaDocsLink, SCHEMA_DOCS_URL } from './SchemaDocsLink';

describe('SchemaDocsLink', () => {
  it('points at the public format reference', () => {
    render(<SchemaDocsLink />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', SCHEMA_DOCS_URL);
  });

  it('opens in a new tab without leaking the opener', () => {
    render(<SchemaDocsLink />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('merges a caller class rather than replacing the defaults', () => {
    render(<SchemaDocsLink className="mt-2" />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('mt-2');
    expect(link.className).toContain('underline');
  });
});
