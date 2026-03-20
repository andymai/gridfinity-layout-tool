import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresenceAvatarBar } from './PresenceAvatarBar';
import type { Participant } from '@/shared/hooks/usePresence';
import { resetAllStores } from '@/test/testUtils';

// Mock child components
vi.mock('../PresenceAvatar', () => ({
  PresenceAvatar: ({ participant }: { participant: Participant }) => (
    <div data-testid="presence-avatar">{participant.name}</div>
  ),
}));

vi.mock('../ConnectionIndicator', () => ({
  ConnectionIndicator: () => <div data-testid="connection-indicator" />,
}));

vi.mock('../PresenceDropdown', () => ({
  PresenceDropdown: ({
    participants,
    onClose,
  }: {
    participants: Participant[];
    onClose: () => void;
  }) => (
    <div data-testid="presence-dropdown">
      <button onClick={onClose} data-testid="close-dropdown">
        Close
      </button>
      {participants.map((p) => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  ),
}));

describe('PresenceAvatarBar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  const mockParticipants: Participant[] = [
    { id: '1', name: 'User 1', color: '#ff0000', isOwner: true, isSelf: false },
    { id: '2', name: 'User 2', color: '#00ff00', isOwner: false, isSelf: true },
  ];

  it('renders without crashing', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
  });

  it('displays connection indicator', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
  });

  it('displays participant count button', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays visible avatars', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    const avatars = screen.getAllByTestId('presence-avatar');
    expect(avatars).toHaveLength(2);
  });

  it('shows overflow button when more than 5 participants', () => {
    const manyParticipants: Participant[] = Array.from({ length: 7 }, (_, i) => ({
      id: `${i}`,
      name: `User ${i}`,
      color: '#ff0000',
      isOwner: false,
      isSelf: false,
    }));
    render(<PresenceAvatarBar participants={manyParticipants} status="connected" />);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('opens dropdown when button clicked', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    const button = screen.getByText('2');
    fireEvent.click(button);
    expect(screen.getByTestId('presence-dropdown')).toBeInTheDocument();
  });

  it('closes dropdown when close button clicked', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    const button = screen.getByText('2');
    fireEvent.click(button);
    expect(screen.getByTestId('presence-dropdown')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-dropdown'));
    expect(screen.queryByTestId('presence-dropdown')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PresenceAvatarBar
        participants={mockParticipants}
        status="connected"
        className="custom-class"
      />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('has correct aria-expanded attribute when dropdown closed', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    const button = screen.getByText('2');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('has correct aria-expanded attribute when dropdown open', () => {
    render(<PresenceAvatarBar participants={mockParticipants} status="connected" />);
    const button = screen.getByText('2');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
