import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabCursors } from './CollabCursors';
import { resetAllStores } from '@/test/testUtils';

// Mock Liveblocks hooks
vi.mock('@/liveblocks.config', () => ({
  useOthers: vi.fn(() => []),
}));

// Mock child components
vi.mock('../CollabCursor', () => ({
  CollabCursor: ({ presence }: { presence: { name: string } }) => (
    <div data-testid="collab-cursor">{presence.name}</div>
  ),
}));

// Mock hooks
vi.mock('@/hooks/useInterpolatedPresence', () => ({
  useInterpolatedPresence: vi.fn(() => new Map()),
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

// Mock translation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'collab.cursors.viewing') {
      return `Viewing with ${params?.count || 0} others`;
    }
    return key;
  },
}));

import { useOthers } from '@/liveblocks.config';
import { useInterpolatedPresence } from '@/hooks/useInterpolatedPresence';

describe('CollabCursors', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CollabCursors />);
  });

  it('renders nothing when there are no other users', () => {
    vi.mocked(useOthers).mockReturnValue([]);
    vi.mocked(useInterpolatedPresence).mockReturnValue(new Map());

    const { container } = render(<CollabCursors />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no interpolated positions exist', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    vi.mocked(useInterpolatedPresence).mockReturnValue(new Map());

    const { container } = render(<CollabCursors />);
    expect(container.firstChild).toBeNull();
  });

  it('renders cursors for users with interpolated positions', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    vi.mocked(useInterpolatedPresence).mockReturnValue(
      new Map([[1, { x: 100, y: 200, opacity: 1 }]])
    );

    render(<CollabCursors />);
    expect(screen.getByTestId('collab-cursor')).toBeInTheDocument();
    expect(screen.getByText('User 1')).toBeInTheDocument();
  });

  it('renders multiple cursors', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
      {
        connectionId: 2,
        presence: {
          cursor: { x: 0.3, y: 0.7 },
          name: 'User 2',
          color: '#00ff00',
          interaction: { type: 'idle' },
        },
        id: '2',
        info: {},
      },
    ]);
    vi.mocked(useInterpolatedPresence).mockReturnValue(
      new Map([
        [1, { x: 100, y: 200, opacity: 1 }],
        [2, { x: 150, y: 250, opacity: 1 }],
      ])
    );

    render(<CollabCursors />);
    const cursors = screen.getAllByTestId('collab-cursor');
    expect(cursors).toHaveLength(2);
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    vi.mocked(useInterpolatedPresence).mockReturnValue(
      new Map([[1, { x: 100, y: 200, opacity: 1 }]])
    );

    const { container } = render(<CollabCursors className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    vi.mocked(useOthers).mockReturnValue([
      {
        connectionId: 1,
        presence: {
          cursor: { x: 0.5, y: 0.5 },
          name: 'User 1',
          color: '#ff0000',
          interaction: { type: 'idle' },
        },
        id: '1',
        info: {},
      },
    ]);
    vi.mocked(useInterpolatedPresence).mockReturnValue(
      new Map([[1, { x: 100, y: 200, opacity: 1 }]])
    );

    render(<CollabCursors />);
    expect(screen.getByLabelText(/Viewing with 1 others/)).toBeInTheDocument();
  });
});
