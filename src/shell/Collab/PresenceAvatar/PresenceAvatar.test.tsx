import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceAvatar } from './PresenceAvatar';
import type { Participant } from '@/shared/hooks/usePresence';
import { resetAllStores } from '@/test/testUtils';

// Mock translation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'collab.owner': 'Owner',
      'collab.you': '(you)',
    };
    return translations[key] || key;
  },
}));

describe('PresenceAvatar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  const mockParticipant: Participant = {
    id: '1',
    name: 'Test User',
    color: '#ff0000',
    isOwner: false,
    isSelf: false,
  };

  it('renders without crashing', () => {
    render(<PresenceAvatar participant={mockParticipant} />);
  });

  it('renders an identicon grid for the participant', () => {
    const { container } = render(<PresenceAvatar participant={mockParticipant} />);
    // 4x4 identicon = 16 cells
    expect(container.querySelectorAll('svg rect')).toHaveLength(16);
  });

  it('displays user name when showName is true', () => {
    render(<PresenceAvatar participant={mockParticipant} showName={true} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('does not display user name when showName is false', () => {
    render(<PresenceAvatar participant={mockParticipant} showName={false} />);
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
  });

  it('shows crown badge for owner', () => {
    const ownerParticipant = { ...mockParticipant, isOwner: true };
    render(<PresenceAvatar participant={ownerParticipant} />);
    expect(screen.getByLabelText('Owner')).toBeInTheDocument();
  });

  it('does not show crown badge for non-owner', () => {
    render(<PresenceAvatar participant={mockParticipant} />);
    expect(screen.queryByLabelText('Owner')).not.toBeInTheDocument();
  });

  it('shows "(you)" label when isSelf is true and showName is true', () => {
    const selfParticipant = { ...mockParticipant, isSelf: true };
    render(<PresenceAvatar participant={selfParticipant} showName={true} />);
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('applies ring styling for self', () => {
    const selfParticipant = { ...mockParticipant, isSelf: true };
    const { container } = render(<PresenceAvatar participant={selfParticipant} />);
    const avatar = container.querySelector('[aria-label*="(you)"]');
    expect(avatar).toHaveClass('ring-2', 'ring-accent');
  });

  it('does not apply ring styling for others', () => {
    const { container } = render(<PresenceAvatar participant={mockParticipant} />);
    const avatar = container.querySelector('[aria-label]');
    expect(avatar).not.toHaveClass('ring-2');
  });

  it('renders small size', () => {
    const { container } = render(<PresenceAvatar participant={mockParticipant} size="sm" />);
    const avatar = container.querySelector('[aria-label]');
    expect(avatar).toHaveClass('w-6', 'h-6');
  });

  it('renders medium size by default', () => {
    const { container } = render(<PresenceAvatar participant={mockParticipant} />);
    const avatar = container.querySelector('[aria-label]');
    expect(avatar).toHaveClass('w-8', 'h-8');
  });

  it('renders large size', () => {
    const { container } = render(<PresenceAvatar participant={mockParticipant} size="lg" />);
    const avatar = container.querySelector('[aria-label]');
    expect(avatar).toHaveClass('w-10', 'h-10');
  });

  it('applies custom className', () => {
    const { container } = render(
      <PresenceAvatar participant={mockParticipant} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<PresenceAvatar participant={mockParticipant} />);
    expect(screen.getByLabelText('Test User')).toBeInTheDocument();
  });

  it('has correct aria-label for self', () => {
    const selfParticipant = { ...mockParticipant, isSelf: true };
    render(<PresenceAvatar participant={selfParticipant} />);
    expect(screen.getByLabelText('Test User (you)')).toBeInTheDocument();
  });
});
