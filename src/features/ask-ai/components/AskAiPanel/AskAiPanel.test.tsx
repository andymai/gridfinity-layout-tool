import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { layoutId } from '@/core/types';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { chatSession } from '../../utils/askAiChat';
import { AskAiPanel } from './AskAiPanel';

const sse = (events: [string, unknown][]): Response =>
  new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });

const input = {
  summary: 'Add a bin for M3 screws',
  ops: [
    {
      op: 'addBin',
      ref: 'm3',
      layer: { id: 'layer1' },
      x: 3,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      label: 'M3 screws',
    },
  ],
};
const call = { type: 'tool_use', id: 'toolu_c', name: 'propose_changes', input };
const fetchMock = vi.fn<typeof fetch>();
const bodyOf = (n: number): Record<string, unknown> =>
  JSON.parse(fetchMock.mock.calls[n]?.[1]?.body as string) as Record<string, unknown>;

beforeEach(() => {
  resetAllStores();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  useLayoutStore.setState({ layout: createTestLayout(), activeLayoutId: layoutId('desk') });
  act(() => chatSession().newChat());
});

describe('AskAiPanel', () => {
  it('offers starter questions in an empty chat', () => {
    render(<AskAiPanel variant="docked" onClose={() => undefined} />);
    expect(screen.getByText('Add a 1 × 1 bin for M3 screws to this layout.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveFocus();
  });

  it('previews a change on the open layout, applies it as one undo step, and shows a label', async () => {
    const jump = vi.fn();
    const findControl = (label: string) => (label === 'Half-grid mode' ? jump : null);
    render(<AskAiPanel variant="docked" onClose={() => undefined} findControl={findControl} />);

    fetchMock.mockResolvedValueOnce(
      sse([
        ['message', { content: [call] }],
        [
          'step',
          { id: 'toolu_c', kind: 'change', state: 'waiting', label: 'x', key: 'proposeChanges' },
        ],
        ['pending', { calls: [{ id: 'toolu_c', name: 'propose_changes', input }], pending: {} }],
      ])
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), {
      target: { value: 'Add M3 screws' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Ask AI suggests changes to this layout')).toBeInTheDocument();
    expect(bodyOf(0)).toMatchObject({ op: 'ask', door: 'app', page: 'app/layout' });
    expect(screen.getByText('Add “M3 screws”, 1 × 1, at 3, 0')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The layout after the changes' })).toBeInTheDocument();

    const before = useLayoutStore.getState().layout.bins.length;
    const undoBefore = useHistoryStore.getState().past.length;
    fetchMock.mockResolvedValueOnce(
      sse([
        [
          'message',
          {
            content: [
              { type: 'text', text: 'Added. Turn on [[ui:Half-grid mode]] for half bins.' },
            ],
          },
        ],
        [
          'done',
          {
            turn: {
              question: 'Add M3 screws',
              page: 'app/layout',
              locale: 'en',
              signature: 'a'.repeat(64),
            },
          },
        ],
      ])
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const label = await screen.findByRole('button', { name: 'Half-grid mode' });
    expect(useLayoutStore.getState().layout.bins).toHaveLength(before + 1);
    expect(useHistoryStore.getState().past).toHaveLength(undoBefore + 1);
    expect(bodyOf(1)).toMatchObject({
      op: 'resume',
      door: 'app',
      results: [{ callId: 'toolu_c', status: 'shared', data: { outcome: 'applied' } }],
    });
    // The folded steps count the change in the reader's language.
    expect(screen.getByRole('button', { name: '1 change set' })).toBeInTheDocument();
    fireEvent.click(label);
    expect(jump).toHaveBeenCalledOnce();
  });

  it('says that Ask AI is off until tomorrow, and takes no question', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"code":"RESTING"}', { status: 429 }));
    render(<AskAiPanel variant="overlay" onClose={() => undefined} />);
    fireEvent.click(screen.getByText('Where is there room for another 2 × 2 bin?'));
    await waitFor(() =>
      expect(screen.getAllByText('Ask AI is off until tomorrow.').length).toBeGreaterThan(0)
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
