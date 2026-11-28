import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useAskAiStore } from '@/features/ask-ai/store/askAiStore';
import { resetAllStores } from '@/test/testUtils';
import { AskAiMount } from './AskAiMount';

vi.mock('@/features/ask-ai/components/AskAiPanel', () => ({
  AskAiPanel: ({
    variant,
    findControl,
  }: {
    variant: string;
    findControl?: (label: string) => (() => void) | null;
  }) => (
    <div data-testid="panel" data-variant={variant}>
      {findControl?.('Half-grid mode') ? 'jumps' : 'plain'}
    </div>
  ),
}));

beforeEach(() => {
  resetAllStores();
  useAskAiStore.setState({ available: true, open: false });
});

describe('AskAiMount', () => {
  it('docks the panel beside the editor on a desktop, once it is open', async () => {
    render(<AskAiMount variant="desktop" />);
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
    act(() => useAskAiStore.getState().setOpen(true));
    const panel = await screen.findByTestId('panel');
    expect(panel).toHaveAttribute('data-variant', 'docked');
    expect(panel).toHaveTextContent('jumps');
  });

  it('closes the inspector when it opens on a tablet', async () => {
    const onOpen = vi.fn();
    render(<AskAiMount variant="tablet" onOpen={onOpen} />);
    act(() => useAskAiStore.getState().setOpen(true));
    expect(await screen.findByTestId('panel')).toHaveAttribute('data-variant', 'overlay');
    expect(onOpen).toHaveBeenCalled();
  });

  it('opens as a sheet on a phone, where labels stay plain', async () => {
    render(<AskAiMount variant="phone" />);
    act(() => useAskAiStore.getState().setOpen(true));
    const panel = await screen.findByTestId('panel');
    expect(panel).toHaveAttribute('data-variant', 'sheet');
    expect(panel).toHaveTextContent('plain');
    expect(screen.getByRole('dialog', { name: 'Ask AI' })).toBeInTheDocument();
  });
});
