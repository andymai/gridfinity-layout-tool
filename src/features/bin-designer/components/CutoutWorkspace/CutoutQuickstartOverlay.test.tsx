import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CutoutQuickstartOverlay } from './CutoutQuickstartOverlay';

describe('CutoutQuickstartOverlay', () => {
  it('renders all 5 feature rows', () => {
    render(<CutoutQuickstartOverlay onDismiss={vi.fn()} />);
    expect(screen.getByText(/shapes/i)).toBeInTheDocument();
    expect(screen.getByText(/select/i)).toBeInTheDocument();
    expect(screen.getByText(/vertex/i)).toBeInTheDocument();
    expect(screen.getByText(/right-click/i)).toBeInTheDocument();
    expect(screen.getByText(/smart guides/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('calls onDismiss when Got it button is clicked', () => {
    const onDismiss = vi.fn();
    render(<CutoutQuickstartOverlay onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText(/got it/i));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss on Escape key', () => {
    const onDismiss = vi.fn();
    render(<CutoutQuickstartOverlay onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has dialog role with aria-labelledby', () => {
    render(<CutoutQuickstartOverlay onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby', 'cutout-quickstart-title');
  });
});
