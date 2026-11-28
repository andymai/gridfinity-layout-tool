import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReaderRequest } from '@/agent/client/session';
import { useLayoutStore } from '@/core/store';
import { layoutId } from '@/core/types';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { AskAiRequestCard } from './AskAiRequestCard';

const request = (calls: ReaderRequest['calls']): ReaderRequest => ({
  pending: {},
  messages: [],
  calls,
  state: 'asking',
});

beforeEach(() => {
  resetAllStores();
  useLayoutStore.setState({ layout: createTestLayout(), activeLayoutId: layoutId('desk') });
});

describe('AskAiRequestCard', () => {
  it('shows what a read shares and asks to allow it', () => {
    const onAnswer = vi.fn();
    render(
      <AskAiRequestCard
        request={request([
          {
            id: 'r',
            title: 'Your layout “Desk”',
            preview: 'Layout "Desk".',
            data: {},
            unavailable: false,
          },
        ])}
        onAnswer={onAnswer}
      />
    );
    expect(screen.getByText('Ask AI wants to read your saved data')).toBeInTheDocument();
    expect(screen.getByText('Layout "Desk".')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "Don't allow" }));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });

  it('says when a change no longer fits, from the layout as it is now', () => {
    const onAnswer = vi.fn();
    const input = {
      summary: 'Add a bin',
      ops: [{ op: 'addBin', layer: { id: 'nope' }, x: 0, y: 0, width: 1, depth: 1, height: 3 }],
    };
    render(
      <AskAiRequestCard
        request={request([
          {
            id: 'c',
            kind: 'change',
            title: 'Add a bin',
            preview: null,
            data: { input },
            unavailable: false,
          },
        ])}
        onAnswer={onAnswer}
      />
    );
    expect(screen.getByText('Ask AI suggests changes to this layout')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('These changes do not fit the layout now');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onAnswer).toHaveBeenCalledWith(true);
  });
});
