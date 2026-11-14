import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveRegion } from './LiveRegion';
import { useInteractionStore } from '@/core/store';

// Mock the store module
vi.mock('@/core/store', () => ({
  useInteractionStore: vi.fn(),
}));

describe('LiveRegion', () => {
  it('keeps an empty region mounted when there is no message', () => {
    vi.mocked(useInteractionStore).mockImplementation((selector: unknown) => {
      const state = { liveMessage: null };
      return (selector as (s: typeof state) => unknown)(state);
    });

    render(<LiveRegion />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('renders message in aria-live region', () => {
    vi.mocked(useInteractionStore).mockImplementation((selector: unknown) => {
      const state = { liveMessage: 'Bin deleted' };
      return (selector as (s: typeof state) => unknown)(state);
    });

    render(<LiveRegion />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Bin deleted');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('is visually hidden with sr-only class', () => {
    vi.mocked(useInteractionStore).mockImplementation((selector: unknown) => {
      const state = { liveMessage: 'Test message' };
      return (selector as (s: typeof state) => unknown)(state);
    });

    render(<LiveRegion />);
    const region = screen.getByRole('status');
    expect(region).toHaveClass('sr-only');
  });
});
