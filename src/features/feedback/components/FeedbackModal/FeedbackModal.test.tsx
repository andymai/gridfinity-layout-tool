import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackModal } from './FeedbackModal';

const mockSubmit = vi.fn();
const mockReset = vi.fn();
vi.mock('../../hooks/useFeedbackSubmit', () => ({
  useFeedbackSubmit: () => ({
    status: 'idle',
    error: null,
    submit: mockSubmit,
    reset: mockReset,
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/core/store', () => ({
  useLayoutStore: Object.assign(
    () => ({
      layout: {
        drawer: { width: 6, depth: 4, height: 5 },
        bins: [{ id: '1' }],
        layers: [{ id: 'l1' }],
      },
    }),
    {
      getState: () => ({
        layout: {
          drawer: { width: 6, depth: 4, height: 5 },
          bins: [{ id: '1' }],
          layers: [{ id: 'l1' }],
        },
      }),
    }
  ),
  useHalfBinModeStore: Object.assign(() => false, {
    getState: () => ({ halfBinMode: false }),
  }),
  useToastStore: Object.assign(() => vi.fn(), {
    getState: () => ({ addToast: vi.fn() }),
  }),
}));

describe('FeedbackModal', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(true);
  });

  it('renders form fields when open', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByLabelText('feedback.categoryLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.descriptionLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.includeContext')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<FeedbackModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('feedback.descriptionLabel')).not.toBeInTheDocument();
  });

  it('submits form with entered values', async () => {
    const onClose = vi.fn();
    render(<FeedbackModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByLabelText('feedback.descriptionLabel'), 'My description');
    await user.click(screen.getByRole('button', { name: 'feedback.submit' }));

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'My description',
        category: 'feature_request',
      })
    );
  });

  it('includes honeypot field (hidden)', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);
    const honeypot = document.querySelector('input[name="hp"]');
    expect(honeypot).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    render(<FeedbackModal isOpen={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'feedback.cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
