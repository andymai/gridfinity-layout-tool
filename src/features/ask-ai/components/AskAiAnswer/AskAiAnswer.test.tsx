import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Exchange } from '@/agent/client/session';
import { AskAiAnswer } from './AskAiAnswer';

const exchange = (extra: Partial<Exchange> = {}): Exchange => ({
  id: 1,
  question: 'Where is half-grid mode?',
  text: 'Turn on [[ui:Half-grid mode]], then [read more](/docs/layouts/half-grid).',
  thinking: '',
  steps: [
    {
      id: 's',
      kind: 'read',
      state: 'done',
      label: 'Reading Layouts › Half grid',
      key: 'readPage',
      vars: { group: 'Layouts', title: 'Half grid' },
    },
  ],
  plans: {},
  status: 'done',
  request: null,
  personal: false,
  notice: null,
  traceId: '00000000-0000-4000-8000-000000000001',
  feedback: null,
  stored: true,
  ...extra,
});

const props = {
  last: true,
  plans: {},
  onShowMe: vi.fn(),
  onAnswer: vi.fn(),
  onRetry: vi.fn(),
  onFeedback: vi.fn(),
  onOpenPlan: vi.fn(),
};

describe('AskAiAnswer', () => {
  it('turns a label with a target into a button that shows it', () => {
    const onShowMe = vi.fn();
    render(
      <AskAiAnswer
        {...props}
        exchange={exchange()}
        onShowMe={onShowMe}
        showMe={{ showMe: (label) => label === 'Half-grid mode', title: 'Show' }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Half-grid mode' }));
    expect(onShowMe).toHaveBeenCalledWith('Half-grid mode');
  });

  it('keeps a label plain without a target, and opens docs links beside the app', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<AskAiAnswer {...props} exchange={exchange()} />);
    expect(screen.queryByRole('button', { name: 'Half-grid mode' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'read more' }));
    expect(open).toHaveBeenCalledWith('/docs/layouts/half-grid', '_blank', 'noopener');
    open.mockRestore();
  });

  it('folds the steps into a count, and opens them in the reader language', () => {
    render(<AskAiAnswer {...props} exchange={exchange()} />);
    fireEvent.click(screen.getByRole('button', { name: '1 page read' }));
    expect(screen.getByText('Reading Layouts › Half grid')).toBeInTheDocument();
  });

  it('words a failure from its code', () => {
    render(
      <AskAiAnswer {...props} exchange={exchange({ text: '', status: 'error', notice: 'busy' })} />
    );
    expect(screen.getByText('Ask AI is busy. Try again in a minute.')).toBeInTheDocument();
  });
});
