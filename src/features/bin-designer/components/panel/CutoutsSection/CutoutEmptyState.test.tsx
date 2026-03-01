import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CutoutEmptyState } from './CutoutEmptyState';

describe('CutoutEmptyState', () => {
  it('renders the drag hint text', () => {
    render(<CutoutEmptyState variant="sidebar" />);
    expect(screen.getByText(/drag to draw/i)).toBeInTheDocument();
  });

  it('renders keyboard shortcut hints', () => {
    render(<CutoutEmptyState variant="sidebar" />);
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('shows V shortcut only in workspace variant', () => {
    const { unmount } = render(<CutoutEmptyState variant="sidebar" />);
    expect(screen.queryByText('V')).not.toBeInTheDocument();
    unmount();

    render(<CutoutEmptyState variant="workspace" />);
    expect(screen.getByText('V')).toBeInTheDocument();
  });
});
