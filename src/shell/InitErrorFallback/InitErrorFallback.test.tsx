import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InitErrorFallback } from './InitErrorFallback';

describe('InitErrorFallback', () => {
  it('renders the error message and a non-destructive reload action', () => {
    render(<InitErrorFallback error={new Error('IndexedDB is unavailable')} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('IndexedDB is unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    // No one-click data wipe on this screen anymore.
    expect(screen.queryByRole('button', { name: /clear data/i })).not.toBeInTheDocument();
  });

  it('reassures the user their data was not deleted', () => {
    render(<InitErrorFallback error={new Error('test')} />);
    expect(screen.getByText(/have not been deleted/i)).toBeInTheDocument();
  });

  it('reloads the page on button click', async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });

    try {
      render(<InitErrorFallback error={new Error('test')} />);
      await user.click(screen.getByRole('button', { name: /reload/i }));
      expect(reloadMock).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });
});
