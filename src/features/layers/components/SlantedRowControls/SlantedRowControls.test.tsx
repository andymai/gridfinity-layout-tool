import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useInteractionStore } from '@/core/store';
import { SlantedRowControls } from './SlantedRowControls';

const slant = () => useInteractionStore.getState().paintSlant;

beforeEach(() => {
  useInteractionStore.setState({ paintSlant: null });
});

describe('SlantedRowControls', () => {
  it('marks slanted rows as experimental', () => {
    render(<SlantedRowControls />);
    const row = screen.getByRole('checkbox', { name: /^Slanted row/ });
    expect(within(row).getByText('Experimental')).toBeInTheDocument();
  });

  it('turns slanted rows on at 45 degrees toward the back, and off again', () => {
    render(<SlantedRowControls />);
    fireEvent.click(screen.getByRole('checkbox', { name: /^Slanted row/ }));
    expect(slant()).toEqual({ angleDeg: 45, side: 'back' });
    fireEvent.click(screen.getByRole('checkbox', { name: /^Slanted row/ }));
    expect(slant()).toBeNull();
  });

  it('sets the side and steps the angle within its range', () => {
    useInteractionStore.setState({ paintSlant: { angleDeg: 58, side: 'back' } });
    render(<SlantedRowControls />);
    fireEvent.click(screen.getByRole('radio', { name: 'Left' }));
    expect(slant()?.side).toBe('left');
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    expect(slant()?.angleDeg).toBe(60);
  });
});
