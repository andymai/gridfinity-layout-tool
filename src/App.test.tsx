import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import App from './App';
import { useInteractionStore } from '@/core/store/interaction';
import { BREAKPOINTS } from '@/core/constants';

const originalWidth = window.innerWidth;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
}

describe('App live region', () => {
  beforeEach(() => {
    useInteractionStore.setState({ liveMessage: null });
  });

  afterEach(() => {
    setViewportWidth(originalWidth);
  });

  it.each([
    ['mobile', 390],
    ['tablet', BREAKPOINTS.MD],
    ['desktop', BREAKPOINTS.LG],
  ])(
    'reads an announcement into exactly one live region on %s',
    (_shell, width) => {
      setViewportWidth(width);
      render(<App />);

      act(() => {
        useInteractionStore.getState().announceToScreenReader('Share failed');
      });

      const regions = screen.getAllByText('Share failed');
      expect(regions).toHaveLength(1);
      expect(regions[0]).toHaveAttribute('role', 'status');
      expect(regions[0]).toHaveAttribute('aria-live', 'polite');
    },
    30_000
  );
});
