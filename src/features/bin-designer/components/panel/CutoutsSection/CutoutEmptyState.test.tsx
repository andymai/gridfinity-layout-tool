import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

  it('hides the scan CTA when no handler is provided', () => {
    render(<CutoutEmptyState variant="sidebar" />);
    expect(screen.queryByText(/scan a real tool/i)).not.toBeInTheDocument();
  });

  it('shows the scan CTA and fires the handler when provided', () => {
    const onScanWithPhone = vi.fn();
    render(<CutoutEmptyState variant="sidebar" onScanWithPhone={onScanWithPhone} />);
    const cta = screen.getByText(/scan a real tool/i);
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onScanWithPhone).toHaveBeenCalledTimes(1);
  });
});
