import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharedWithMeList } from './SharedWithMeList';
import { resetAllStores } from '@/test/testUtils';
import type { SharedWithMeEntry } from '@/core/types';
import { useSharedWithMe } from '@/shared/hooks';

// Mock hooks
vi.mock('@/shared/hooks');

// Mock child component
vi.mock('../SharedWithMeItem', () => ({
  SharedWithMeItem: ({
    entry,
    onOpen,
  }: {
    entry: SharedWithMeEntry;
    isFocused: boolean;
    isLoading: boolean;
    onOpen: () => void;
    onRemove: () => void;
    onFocus: () => void;
    itemRef: (el: HTMLDivElement | null) => void;
  }) => (
    <div data-testid={`shared-item-${entry.id}`}>
      <span>{entry.name}</span>
      <button onClick={onOpen}>Open</button>
    </div>
  ),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('SharedWithMeList', () => {
  const mockOnOpenLayout = vi.fn();

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Default mock
    vi.mocked(useSharedWithMe).mockReturnValue({
      sharedWithMe: [],
      isLoaded: true,
      status: 'idle',
      openSharedLayout: vi.fn(),
      removeSharedLayout: vi.fn(),
    });
  });

  it('shows loading state while loading', () => {
    vi.mocked(useSharedWithMe).mockReturnValue({
      sharedWithMe: [],
      isLoaded: false,
      status: 'idle',
      openSharedLayout: vi.fn(),
      removeSharedLayout: vi.fn(),
    });

    render(<SharedWithMeList onOpenLayout={mockOnOpenLayout} />);
    expect(screen.getByText('loading.sharedWithMe')).toBeInTheDocument();
  });

  it('shows empty state when no shared layouts', () => {
    render(<SharedWithMeList onOpenLayout={mockOnOpenLayout} />);

    expect(screen.getByText('layouts.noSharedLayoutsYet')).toBeInTheDocument();
  });

  it('renders shared layout items', () => {
    const mockEntries: SharedWithMeEntry[] = [
      {
        id: 'shared-1',
        sourceShareId: 'share-1',
        name: 'Shared Layout 1',
        authorName: 'Author 1',
        permission: 'view',
        lastAccessedAt: 2000000,
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 2,
          binMap: [],
        },
      },
      {
        id: 'shared-2',
        sourceShareId: 'share-2',
        name: 'Shared Layout 2',
        authorName: 'Author 2',
        permission: 'edit',
        lastAccessedAt: 1000000,
        preview: {
          drawerWidth: 12,
          drawerDepth: 10,
          drawerHeight: 15,
          binCount: 8,
          layerCount: 3,
          binMap: [],
        },
      },
    ];

    vi.mocked(useSharedWithMe).mockReturnValue({
      sharedWithMe: mockEntries,
      isLoaded: true,
      status: 'idle',
      openSharedLayout: vi.fn(),
      removeSharedLayout: vi.fn(),
    });

    render(<SharedWithMeList onOpenLayout={mockOnOpenLayout} />);

    expect(screen.getByTestId('shared-item-shared-1')).toBeInTheDocument();
    expect(screen.getByTestId('shared-item-shared-2')).toBeInTheDocument();
    expect(screen.getByText('Shared Layout 1')).toBeInTheDocument();
    expect(screen.getByText('Shared Layout 2')).toBeInTheDocument();
  });

  it('sorts layouts by last accessed (most recent first)', () => {
    const mockEntries: SharedWithMeEntry[] = [
      {
        id: 'shared-old',
        sourceShareId: 'share-old',
        name: 'Old Layout',
        permission: 'view',
        lastAccessedAt: 1000000,
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 2,
          binMap: [],
        },
      },
      {
        id: 'shared-new',
        sourceShareId: 'share-new',
        name: 'New Layout',
        permission: 'view',
        lastAccessedAt: 3000000,
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 2,
          binMap: [],
        },
      },
    ];

    vi.mocked(useSharedWithMe).mockReturnValue({
      sharedWithMe: mockEntries,
      isLoaded: true,
      status: 'idle',
      openSharedLayout: vi.fn(),
      removeSharedLayout: vi.fn(),
    });

    const { container } = render(<SharedWithMeList onOpenLayout={mockOnOpenLayout} />);
    const items = container.querySelectorAll('[data-testid^="shared-item-"]');

    // First item should be the newer one
    expect(items[0]).toHaveAttribute('data-testid', 'shared-item-shared-new');
    expect(items[1]).toHaveAttribute('data-testid', 'shared-item-shared-old');
  });

  it('shows count summary', () => {
    const mockEntries: SharedWithMeEntry[] = [
      {
        id: 'shared-1',
        sourceShareId: 'share-1',
        name: 'Layout 1',
        permission: 'view',
        lastAccessedAt: 1000000,
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 2,
          binMap: [],
        },
      },
      {
        id: 'shared-2',
        sourceShareId: 'share-2',
        name: 'Layout 2',
        permission: 'view',
        lastAccessedAt: 2000000,
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 2,
          binMap: [],
        },
      },
    ];

    vi.mocked(useSharedWithMe).mockReturnValue({
      sharedWithMe: mockEntries,
      isLoaded: true,
      status: 'idle',
      openSharedLayout: vi.fn(),
      removeSharedLayout: vi.fn(),
    });

    render(<SharedWithMeList onOpenLayout={mockOnOpenLayout} />);
    expect(screen.getByText(/layouts.sharedLayoutCount/)).toBeInTheDocument();
  });

  it('shows error message when status is error', () => {
    const mockEntries: SharedWithMeEntry[] = [
      {
        id: 'shared-1',
        sourceShareId: 'share-1',
        name: 'Layout 1',
        permission: 'view',
        lastAccessedAt: 1000000,
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 2,
          binMap: [],
        },
      },
    ];

    vi.mocked(useSharedWithMe).mockReturnValue({
      sharedWithMe: mockEntries,
      isLoaded: true,
      status: 'error',
      openSharedLayout: vi.fn(),
      removeSharedLayout: vi.fn(),
    });

    render(<SharedWithMeList onOpenLayout={mockOnOpenLayout} />);
    expect(screen.getByText('layouts.openSharedFailed')).toBeInTheDocument();
  });
});
