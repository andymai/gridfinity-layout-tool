import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from '@/core/sync/session/useSession';
import { SupporterPanel } from './SupporterPanel';
import type { SupporterStatus } from '../../api/supporterClient';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const NOT_SUPPORTER: SupporterStatus = {
  supporter: false,
  badgePublic: false,
  name: null,
  message: null,
};

function supporter(overrides: Partial<SupporterStatus> = {}): SupporterStatus {
  return { supporter: true, badgePublic: true, name: 'Jo', message: 'Nice tool', ...overrides };
}

function renderPanel(props: Partial<React.ComponentProps<typeof SupporterPanel>> = {}) {
  const save = vi.fn().mockResolvedValue(null);
  render(
    <SupporterPanel open onClose={vi.fn()} status={NOT_SUPPORTER} settled save={save} {...props} />
  );
  return { save };
}

describe('SupporterPanel', () => {
  beforeEach(() => {
    useSessionStore.setState({ status: 'anonymous', user: null });
  });

  describe('a visitor who has not supported', () => {
    it('shows what supporting gets them, not the edit controls', () => {
      renderPanel();
      expect(screen.getByText('A bin on this wall')).toBeInTheDocument();
      expect(screen.getByText('A supporter badge')).toBeInTheDocument();
      expect(screen.queryByLabelText('Name on your bin')).not.toBeInTheDocument();
    });

    it('states that there are no tiers, matching how the wall actually works', () => {
      renderPanel();
      expect(screen.getByText(/No tiers and no amounts/)).toBeInTheDocument();
    });

    it('offers sign-in when signed out', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /GitHub/ })).toBeInTheDocument();
    });

    it('explains the miss instead of offering sign-in when already signed in', () => {
      useSessionStore.setState({ status: 'authenticated', user: null });
      renderPanel();
      expect(screen.getByText(/isn't matched to a Ko-fi payment/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument();
    });
  });

  describe('a linked supporter', () => {
    it('shows their current name and message', () => {
      renderPanel({ status: supporter() });
      expect(screen.getByDisplayValue('Jo')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Nice tool')).toBeInTheDocument();
    });

    it('saves a renamed bin', async () => {
      const { save } = renderPanel({ status: supporter() });
      const nameField = screen.getByDisplayValue('Jo');
      await userEvent.clear(nameField);
      await userEvent.type(nameField, 'Joanne');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Joanne', badgePublic: true })
      );
    });

    it('sends a null name for an emptied field, which is how a bin goes anonymous', async () => {
      const { save } = renderPanel({ status: supporter() });
      await userEvent.clear(screen.getByDisplayValue('Jo'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
    });

    it('disables the message field for an anonymous bin, which never carries one', () => {
      renderPanel({ status: supporter({ name: null, message: null }) });
      expect(screen.getByPlaceholderText('Optional, shown on the wall')).toBeDisabled();
      expect(screen.getByText('An anonymous bin carries no message.')).toBeInTheDocument();
    });

    it("surfaces the server's reason when an edit is rejected", async () => {
      const save = vi.fn().mockResolvedValue({ kind: 'blocked', message: 'Nope, not that name.' });
      render(<SupporterPanel open onClose={vi.fn()} status={supporter()} settled save={save} />);
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Nope, not that name.');
    });

    it('offers to fly to their bin only when one was located', () => {
      const onFindMyBin = vi.fn();
      const { rerender } = render(
        <SupporterPanel
          open
          onClose={vi.fn()}
          status={supporter()}
          settled
          save={vi.fn()}
          onFindMyBin={onFindMyBin}
        />
      );
      expect(screen.getByRole('button', { name: 'Show me my bin' })).toBeInTheDocument();

      // An anonymous supporter has no findable bin, so the affordance must not
      // be offered rather than point at somebody else's.
      rerender(
        <SupporterPanel open onClose={vi.fn()} status={supporter()} settled save={vi.fn()} />
      );
      expect(screen.queryByRole('button', { name: 'Show me my bin' })).not.toBeInTheDocument();
    });
  });

  it('shows neither branch until the status read settles', () => {
    renderPanel({ status: supporter(), settled: false });
    // A supporter must never read "here is what supporters get" — an ask aimed
    // at someone who has not paid — and watch it swap once their status lands.
    expect(screen.queryByText('A supporter badge')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Jo')).not.toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <SupporterPanel open={false} onClose={vi.fn()} status={supporter()} settled save={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
