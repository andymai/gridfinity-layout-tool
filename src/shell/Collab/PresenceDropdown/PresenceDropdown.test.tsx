import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { PresenceDropdown } from './PresenceDropdown';
import type { Participant } from '@/shared/hooks/usePresence';
import { resetAllStores } from '@/test/testUtils';
import { useRef } from 'react';

// Mock child components
vi.mock('../PresenceAvatarList', () => ({
  PresenceAvatarList: ({ participants }: { participants: Participant[] }) => (
    <div data-testid="presence-avatar-list">
      {participants.map((p) => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  ),
}));

vi.mock('../ConnectionIndicator', () => ({
  ConnectionIndicator: () => <div data-testid="connection-indicator" />,
}));

// Mock translation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, number | string>) => {
    if (key === 'collab.participantCount') {
      return `${String(params?.count ?? 0)} participants`;
    }
    if (key === 'common.close') return 'Close';
    if (key === 'collab.participants') return 'Participants';
    return key;
  },
}));

function TestWrapper({ onClose }: { onClose: () => void }) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const participants: Participant[] = [
    { id: '1', name: 'User 1', color: '#ff0000', isOwner: true, isSelf: false },
    { id: '2', name: 'User 2', color: '#00ff00', isOwner: false, isSelf: true },
  ];

  return (
    <div>
      <div ref={triggerRef} data-testid="trigger">
        Trigger
      </div>
      <PresenceDropdown
        participants={participants}
        status="connected"
        triggerRef={triggerRef}
        onClose={onClose}
      />
    </div>
  );
}

describe('PresenceDropdown', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders without crashing', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);
  });

  it('displays participant count', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  it('displays connection indicator', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);
    expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
  });

  it('displays participant list', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);
    expect(screen.getByTestId('presence-avatar-list')).toBeInTheDocument();
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has correct role and aria-label', () => {
    const onClose = vi.fn();
    render(<TestWrapper onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Participants' })).toBeInTheDocument();
  });

  it('has aria-modal attribute', () => {
    const onClose = vi.fn();
    const { container } = render(<TestWrapper onClose={onClose} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  describe('click outside', () => {
    async function renderWithOutsideClickListener(onClose: () => void) {
      render(<TestWrapper onClose={onClose} />);
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
    }

    function selfRemovingButton(parent: HTMLElement): HTMLButtonElement {
      const button = document.createElement('button');
      button.addEventListener('click', () => {
        button.remove();
      });
      parent.appendChild(button);
      return button;
    }

    it('stays open on a click inside the dropdown', async () => {
      const onClose = vi.fn();
      await renderWithOutsideClickListener(onClose);

      fireEvent.click(screen.getByText('User 1'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('stays open on a click on the trigger', async () => {
      const onClose = vi.fn();
      await renderWithOutsideClickListener(onClose);

      fireEvent.click(screen.getByTestId('trigger'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('stays open on a click inside whose own handler removes the clicked control', async () => {
      const onClose = vi.fn();
      await renderWithOutsideClickListener(onClose);
      const control = selfRemovingButton(screen.getByRole('dialog'));

      fireEvent.click(control);

      expect(control.isConnected).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on a click outside the dropdown and the trigger', async () => {
      const onClose = vi.fn();
      await renderWithOutsideClickListener(onClose);
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      fireEvent.click(outside);

      expect(onClose).toHaveBeenCalledTimes(1);
      outside.remove();
    });

    it('closes on an outside click whose own handler removes the clicked element', async () => {
      const onClose = vi.fn();
      await renderWithOutsideClickListener(onClose);
      const outside = selfRemovingButton(document.body);

      fireEvent.click(outside);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
