import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useInteractionStore, useLabsStore } from '@/core/store';
import { SlantedRowControls } from './SlantedRowControls';

function setLabs(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, slant: enabled },
    },
  }));
}

const slant = () => useInteractionStore.getState().paintSlant;

beforeEach(() => {
  useInteractionStore.setState({ paintSlant: null });
  setLabs(true);
});

describe('SlantedRowControls', () => {
  it('stays hidden with the labs flag off and the mode unset', () => {
    setLabs(false);
    render(<SlantedRowControls />);
    expect(screen.queryByTestId('slanted-row-controls')).toBeNull();
  });

  it('turns slanted rows on at 45 degrees toward the back, and off again', () => {
    render(<SlantedRowControls />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Slanted row' }));
    expect(slant()).toEqual({ angleDeg: 45, side: 'back' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Slanted row' }));
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
