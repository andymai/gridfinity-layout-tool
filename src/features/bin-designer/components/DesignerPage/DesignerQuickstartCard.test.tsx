// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignerQuickstartCard } from './DesignerQuickstartCard';

describe('DesignerQuickstartCard', () => {
  it('renders the orientation rows', () => {
    render(<DesignerQuickstartCard onDismiss={vi.fn()} />);

    expect(screen.getByRole('region', { name: /design a custom bin/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('dismisses via the Got it button', () => {
    const onDismiss = vi.fn();
    render(<DesignerQuickstartCard onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /got it/i }));

    expect(onDismiss).toHaveBeenCalledWith('got_it');
  });

  it('dismisses via Escape', () => {
    const onDismiss = vi.fn();
    render(<DesignerQuickstartCard onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledWith('escape');
  });
});
