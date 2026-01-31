import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceAvatarList } from './PresenceAvatarList';
import type { Participant } from '@/hooks/usePresence';
import { resetAllStores } from '@/test/testUtils';

// Mock child component
vi.mock('../PresenceAvatar', () => ({
  PresenceAvatar: ({ participant }: { participant: Participant }) => (
    <div data-testid="presence-avatar">{participant.name}</div>
  ),
}));

// Mock translation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'collab.noOneHere': 'No one here',
      'collab.participants': 'Participants',
      'collab.you': '(you)',
      'collab.owner': 'Owner',
    };
    return translations[key] || key;
  },
}));

describe('PresenceAvatarList', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  const mockParticipants: Participant[] = [
    { id: '1', name: 'User 1', color: '#ff0000', isOwner: true, isSelf: false },
    { id: '2', name: 'User 2', color: '#00ff00', isOwner: false, isSelf: true },
  ];

  it('renders without crashing', () => {
    render(<PresenceAvatarList participants={mockParticipants} />);
  });

  it('displays all participants', () => {
    render(<PresenceAvatarList participants={mockParticipants} />);
    const user1Elements = screen.getAllByText('User 1');
    const user2Elements = screen.getAllByText('User 2');
    expect(user1Elements.length).toBeGreaterThan(0);
    expect(user2Elements.length).toBeGreaterThan(0);
  });

  it('shows empty message when no participants', () => {
    render(<PresenceAvatarList participants={[]} />);
    expect(screen.getByText('No one here')).toBeInTheDocument();
  });

  it('displays "(you)" label for self', () => {
    render(<PresenceAvatarList participants={mockParticipants} />);
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('displays "Owner" badge for owner', () => {
    render(<PresenceAvatarList participants={mockParticipants} />);
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('highlights self with background', () => {
    const { container } = render(<PresenceAvatarList participants={mockParticipants} />);
    const listItems = container.querySelectorAll('li');
    // User 2 is self (index 1)
    expect(listItems[1]).toHaveClass('bg-surface-hover');
  });

  it('does not highlight others with background', () => {
    const { container } = render(<PresenceAvatarList participants={mockParticipants} />);
    const listItems = container.querySelectorAll('li');
    // User 1 is not self (index 0)
    expect(listItems[0]).not.toHaveClass('bg-surface-hover');
  });

  it('applies custom className', () => {
    const { container } = render(
      <PresenceAvatarList participants={mockParticipants} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('has correct aria-label for list', () => {
    render(<PresenceAvatarList participants={mockParticipants} />);
    expect(screen.getByLabelText('Participants')).toBeInTheDocument();
  });
});
