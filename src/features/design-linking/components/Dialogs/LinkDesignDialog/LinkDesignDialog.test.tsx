import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkDesignDialog } from './LinkDesignDialog';
import { resetAllStores } from '@/test/testUtils';
import { useLinkingStore } from '../../../store';

const mockListDesigns = vi.fn();

// Mock stores and hooks
vi.mock('../../../store');
vi.mock('../../../hooks', () => ({
  useBinLinking: () => ({
    linkBin: vi.fn(),
  }),
}));

vi.mock('@/core/result', () => ({
  isOk: vi.fn(() => true),
}));

vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  listDesigns: (...args: unknown[]) => mockListDesigns(...args),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('LinkDesignDialog', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '';

    // Default mock for useLinkingStore
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: null,
      hideLinkDesignDialog: vi.fn(),
    });

    // Default mock for listDesigns
    mockListDesigns.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'design-1',
          name: 'Test Design 1',
          params: { width: 2, depth: 3, height: 5, compartments: { cells: [0, 0, 1, 1] } },
          thumbnail: null,
        },
        {
          id: 'design-2',
          name: 'Test Design 2',
          params: { width: 2, depth: 3, height: 7, compartments: { cells: [0] } },
          thumbnail: 'data:image/png;base64,test',
        },
      ],
    });
  });

  it('does not render when pendingLinkDesign is null', () => {
    render(<LinkDesignDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when pendingLinkDesign is set', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: {
        binId: 'bin-1',
        footprint: { width: 2, depth: 3 },
        binHeight: 5,
      },
      hideLinkDesignDialog: vi.fn(),
    });

    render(<LinkDesignDialog />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows loading state while fetching designs', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: {
        binId: 'bin-1',
        footprint: { width: 2, depth: 3 },
        binHeight: 5,
      },
      hideLinkDesignDialog: vi.fn(),
    });

    render(<LinkDesignDialog />);
    expect(screen.getByText('designLinking.linkDialog.loading')).toBeInTheDocument();
  });

  it('displays footprint dimensions in header', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: {
        binId: 'bin-1',
        footprint: { width: 4, depth: 5 },
        binHeight: 3,
      },
      hideLinkDesignDialog: vi.fn(),
    });

    render(<LinkDesignDialog />);
    expect(screen.getByText(/designLinking.linkDialog.footprint/)).toBeInTheDocument();
  });

  it('calls hideLinkDesignDialog on cancel', () => {
    const mockHide = vi.fn();
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: {
        binId: 'bin-1',
        footprint: { width: 2, depth: 3 },
        binHeight: 5,
      },
      hideLinkDesignDialog: mockHide,
    });

    render(<LinkDesignDialog />);
    fireEvent.click(screen.getByText('common.cancel'));

    expect(mockHide).toHaveBeenCalled();
  });

  it('renders search input when there are many designs', async () => {
    // Return more than 3 designs
    mockListDesigns.mockResolvedValue({
      ok: true,
      value: Array.from({ length: 5 }, (_, i) => ({
        id: `design-${i}`,
        name: `Design ${i}`,
        params: { width: 2, depth: 3, height: 5, compartments: { cells: [0] } },
        thumbnail: null,
      })),
    });

    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: {
        binId: 'bin-1',
        footprint: { width: 2, depth: 3 },
        binHeight: 5,
      },
      hideLinkDesignDialog: vi.fn(),
    });

    render(<LinkDesignDialog />);

    // Wait for designs to load
    await screen.findByPlaceholderText('designLinking.linkDialog.searchPlaceholder');
  });

  it('shows close button in header', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingLinkDesign: {
        binId: 'bin-1',
        footprint: { width: 2, depth: 3 },
        binHeight: 5,
      },
      hideLinkDesignDialog: vi.fn(),
    });

    render(<LinkDesignDialog />);
    expect(screen.getByLabelText('common.close')).toBeInTheDocument();
  });
});
