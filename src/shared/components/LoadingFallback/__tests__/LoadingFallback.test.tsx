import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingFallback } from '../LoadingFallback';

describe('LoadingFallback', () => {
  it('renders fullscreen variant by default', () => {
    const { container } = render(<LoadingFallback />);
    expect(container.querySelector('.h-screen')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders overlay variant with backdrop', () => {
    const { container } = render(<LoadingFallback variant="overlay" />);
    expect(container.querySelector('.fixed.inset-0')).not.toBeNull();
  });

  it('renders panel variant with flex container', () => {
    const { container } = render(<LoadingFallback variant="panel" />);
    expect(container.querySelector('.flex-1')).not.toBeNull();
  });

  it('renders inline variant with padding', () => {
    const { container } = render(<LoadingFallback variant="inline" />);
    expect(container.querySelector('.py-8')).not.toBeNull();
  });

  it('uses custom label for accessibility', () => {
    render(<LoadingFallback label="Loading bin designer" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading bin designer');
  });
});
