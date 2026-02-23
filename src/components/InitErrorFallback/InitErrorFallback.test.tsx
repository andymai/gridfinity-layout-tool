import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InitErrorFallback } from './InitErrorFallback';

describe('InitErrorFallback', () => {
  it('renders error message and recovery button', () => {
    const error = new Error('IndexedDB is unavailable');
    render(<InitErrorFallback error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('IndexedDB is unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear data/i })).toBeInTheDocument();
  });

  it('clears localStorage and reloads on button click', async () => {
    const user = userEvent.setup();
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<InitErrorFallback error={new Error('test')} />);
    await user.click(screen.getByRole('button', { name: /clear data/i }));

    expect(clearSpy).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();

    clearSpy.mockRestore();
  });
});
