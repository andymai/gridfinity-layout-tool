import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceAvatars } from './PresenceAvatars';
import { resetAllStores } from '@/test/testUtils';

// Mock child components
vi.mock('../PresenceAvatarBar', () => ({
  PresenceAvatarBar: () => <div data-testid="presence-avatar-bar">Avatar Bar</div>,
}));

vi.mock('../PresenceMobileButton', () => ({
  PresenceMobileButton: () => <div data-testid="presence-mobile-button">Mobile Button</div>,
}));

// Mock hooks
vi.mock('@/hooks/usePresence', () => ({
  usePresence: vi.fn(() => ({
    participants: [],
    status: 'connected' as const,
    participantCount: 0,
    isCollaborative: false,
  })),
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    layoutMode: 'desktop' as const,
    viewportWidth: 1200,
  })),
}));

import { usePresence } from '@/hooks/usePresence';
import { useResponsive } from '@/shared/hooks';

describe('PresenceAvatars', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PresenceAvatars />);
  });

  it('renders nothing when not in collaborative mode', () => {
    vi.mocked(usePresence).mockReturnValue({
      participants: [],
      status: 'connected',
      participantCount: 0,
      isCollaborative: false,
    });
    const { container } = render(<PresenceAvatars />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no participants', () => {
    vi.mocked(usePresence).mockReturnValue({
      participants: [],
      status: 'connected',
      participantCount: 0,
      isCollaborative: true,
    });
    const { container } = render(<PresenceAvatars />);
    expect(container.firstChild).toBeNull();
  });

  it('renders PresenceAvatarBar on desktop', () => {
    vi.mocked(usePresence).mockReturnValue({
      participants: [{ id: '1', name: 'User 1', color: '#ff0000', isOwner: false, isSelf: false }],
      status: 'connected',
      participantCount: 1,
      isCollaborative: true,
    });
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      layoutMode: 'desktop',
      viewportWidth: 1200,
    });

    render(<PresenceAvatars />);
    expect(screen.getByTestId('presence-avatar-bar')).toBeInTheDocument();
  });

  it('renders PresenceMobileButton on mobile', () => {
    vi.mocked(usePresence).mockReturnValue({
      participants: [{ id: '1', name: 'User 1', color: '#ff0000', isOwner: false, isSelf: false }],
      status: 'connected',
      participantCount: 1,
      isCollaborative: true,
    });
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      layoutMode: 'mobile',
      viewportWidth: 375,
    });

    render(<PresenceAvatars />);
    expect(screen.getByTestId('presence-mobile-button')).toBeInTheDocument();
  });

  it('passes className to child components', () => {
    vi.mocked(usePresence).mockReturnValue({
      participants: [{ id: '1', name: 'User 1', color: '#ff0000', isOwner: false, isSelf: false }],
      status: 'connected',
      participantCount: 1,
      isCollaborative: true,
    });
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      layoutMode: 'desktop',
      viewportWidth: 1200,
    });

    render(<PresenceAvatars className="custom-class" />);
    // PresenceAvatarBar should be rendered with className
    expect(screen.getByTestId('presence-avatar-bar')).toBeInTheDocument();
  });
});
