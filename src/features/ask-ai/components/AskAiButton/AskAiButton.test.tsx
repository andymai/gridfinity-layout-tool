import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { resetAskAiAvailability, useAskAiStore } from '../../store/askAiStore';
import { AskAiButton } from './AskAiButton';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetAskAiAvailability();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('AskAiButton', () => {
  it('stays hidden while the app door is off', async () => {
    fetchMock.mockResolvedValue(Response.json({ enabled: false, resting: false }));
    render(<AskAiButton />);
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/docs-ask?door=app', expect.anything())
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows once the door is on, and opens and closes the panel', async () => {
    fetchMock.mockResolvedValue(Response.json({ enabled: true, resting: false }));
    render(<AskAiButton />);
    const button = await screen.findByRole('button', { name: 'Ask AI' });
    fireEvent.click(button);
    expect(useAskAiStore.getState().open).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(useAskAiStore.getState().open).toBe(false);
  });
});
