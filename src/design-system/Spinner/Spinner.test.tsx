import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders with status role', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has default "Loading" label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('accepts custom label', () => {
    render(<Spinner label="Saving" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Saving');
  });

  it('renders sr-only text for screen readers', () => {
    render(<Spinner label="Processing" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('applies className', () => {
    render(<Spinner className="text-accent" />);
    expect(screen.getByRole('status')).toHaveClass('text-accent');
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Spinner ref={ref} />);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
  });
});
