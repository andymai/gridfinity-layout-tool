import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaveStatusIndicator } from './SaveStatusIndicator';

describe('SaveStatusIndicator', () => {
  it('returns null when status is idle', () => {
    const { container } = render(<SaveStatusIndicator status="idle" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders saving text', () => {
    render(<SaveStatusIndicator status="saving" />);
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it('renders saved text', () => {
    render(<SaveStatusIndicator status="saved" />);
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it('renders error text', () => {
    render(<SaveStatusIndicator status="error" />);
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });

  it('omits text in compact mode', () => {
    render(<SaveStatusIndicator status="saving" compact />);
    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
  });

  it('has status role for accessibility', () => {
    render(<SaveStatusIndicator status="saved" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
