// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseplateQuickstartCard } from './BaseplateQuickstartCard';

describe('BaseplateQuickstartCard', () => {
  it('renders the orientation rows', () => {
    render(<BaseplateQuickstartCard onDismiss={vi.fn()} />);

    expect(
      screen.getByRole('region', { name: /generate a drawer baseplate/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('dismisses via the Got it button', () => {
    const onDismiss = vi.fn();
    render(<BaseplateQuickstartCard onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /got it/i }));

    expect(onDismiss).toHaveBeenCalledWith('got_it');
  });
});
