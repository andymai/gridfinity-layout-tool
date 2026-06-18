import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedDesignSection } from './LinkedDesignSection';
import { resetAllStores, createTestBin } from '@/test/testUtils';
import type { Bin } from '@/core/types';
import { useLinkedDesign, useBinLinking, useQuickExport } from '../../hooks';
import { useDesignThumbnail } from '@/features/bin-designer/hooks/useDesignThumbnail';

// Mock hooks
vi.mock('../../hooks');
vi.mock('@/features/bin-designer/hooks/useDesignThumbnail', () => ({
  useDesignThumbnail: vi.fn(() => ({ thumbnail: null, isLoading: false })),
}));
vi.mock('../../store', () => ({
  useLinkingStore: vi.fn((selector) => {
    const state = { showLinkDesignDialog: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/shared/components', () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('LinkedDesignSection', () => {
  const testBin: Bin = createTestBin({ id: 'bin-1', linkedDesignId: undefined });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(useLinkedDesign).mockReturnValue({
      linkedDesign: null,
      isStale: false,
      hasLink: false,
    });

    vi.mocked(useBinLinking).mockReturnValue({
      editLinkedDesign: vi.fn(),
      showCreateDesignDialog: vi.fn(),
      unlinkBin: vi.fn(),
      deleteLinkedDesign: vi.fn(),
    });

    vi.mocked(useQuickExport).mockReturnValue({
      isExporting: false,
      exportToSTL: vi.fn(),
    });
  });

  it('renders create and link buttons when no link', () => {
    render(<LinkedDesignSection bin={testBin} variant="desktop" />);

    expect(screen.getByText('designLinking.inspector.createDesign')).toBeInTheDocument();
    expect(screen.getByText('designLinking.inspector.linkExisting')).toBeInTheDocument();
  });

  it('does not show an experimental badge', () => {
    render(<LinkedDesignSection bin={testBin} variant="desktop" />);
    expect(screen.queryByText('settings.experimental')).not.toBeInTheDocument();
  });

  it('calls showCreateDesignDialog when create button clicked', () => {
    const mockShowCreate = vi.fn();
    vi.mocked(useBinLinking).mockReturnValue({
      editLinkedDesign: vi.fn(),
      showCreateDesignDialog: mockShowCreate,
      unlinkBin: vi.fn(),
      deleteLinkedDesign: vi.fn(),
    });

    render(<LinkedDesignSection bin={testBin} variant="desktop" />);
    fireEvent.click(screen.getByText('designLinking.inspector.createDesign'));

    expect(mockShowCreate).toHaveBeenCalledWith('bin-1');
  });

  it('shows stale link warning when design is deleted', () => {
    vi.mocked(useLinkedDesign).mockReturnValue({
      linkedDesign: null,
      isStale: true,
      hasLink: true,
    });

    render(<LinkedDesignSection bin={testBin} variant="desktop" />);
    expect(screen.getByText('designLinking.inspector.designDeleted')).toBeInTheDocument();
    expect(screen.getByText('designLinking.inspector.unlink')).toBeInTheDocument();
  });

  it('renders linked design with thumbnail and actions', () => {
    vi.mocked(useDesignThumbnail).mockReturnValue({
      thumbnail: 'data:image/png;base64,abc123',
      isLoading: false,
    });
    vi.mocked(useLinkedDesign).mockReturnValue({
      linkedDesign: {
        id: 'design-1',
        name: 'My Design',
        width: 2,
        depth: 3,
        height: 5,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isStale: false,
      hasLink: true,
    });

    render(<LinkedDesignSection bin={testBin} variant="desktop" />);

    expect(screen.getByText('My Design')).toBeInTheDocument();
    expect(screen.getByText(/2×3×5u/)).toBeInTheDocument();
    expect(screen.getByText('designLinking.inspector.editDesign')).toBeInTheDocument();
    expect(screen.getByText('common.export')).toBeInTheDocument();

    const img = screen.getByRole('img', { name: 'My Design' });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('shows placeholder thumbnail when no thumbnail available', () => {
    vi.mocked(useLinkedDesign).mockReturnValue({
      linkedDesign: {
        id: 'design-1',
        name: 'My Design',
        width: 2,
        depth: 3,
        height: 5,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isStale: false,
      hasLink: true,
    });

    render(<LinkedDesignSection bin={testBin} variant="desktop" />);
    expect(screen.getByText('My Design')).toBeInTheDocument();
  });

  it('uses mobile-specific styling when variant is mobile', () => {
    vi.mocked(useLinkedDesign).mockReturnValue({
      linkedDesign: {
        id: 'design-1',
        name: 'Mobile Design',
        width: 2,
        depth: 3,
        height: 5,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isStale: false,
      hasLink: true,
    });

    render(<LinkedDesignSection bin={testBin} variant="mobile" />);
    expect(screen.getByText('Mobile Design')).toBeInTheDocument();
  });

  it('opens overflow menu and shows unlink and delete options', () => {
    vi.mocked(useLinkedDesign).mockReturnValue({
      linkedDesign: {
        id: 'design-1',
        name: 'My Design',
        width: 2,
        depth: 3,
        height: 5,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isStale: false,
      hasLink: true,
    });

    render(<LinkedDesignSection bin={testBin} variant="desktop" />);

    const moreButton = screen.getByTitle('common.moreOptions');
    fireEvent.click(moreButton);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
