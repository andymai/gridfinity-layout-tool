import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateDesignDialog } from './CreateDesignDialog';
import { resetAllStores } from '@/test/testUtils';
import { useLinkingStore } from '../../../store';

// Mock stores and hooks
vi.mock('../../../store', () => ({
  useLinkingStore: vi.fn(() => ({
    pendingCreateDesign: null,
    hideCreateDesignDialog: vi.fn(),
  })),
}));

vi.mock('../../../hooks', () => ({
  useBinLinking: () => ({
    navigateToCreateDesign: vi.fn(),
  }),
}));

vi.mock('../../../domain', () => ({
  formatDimensions: (dims: { width: number; depth: number; height: number }) =>
    `${dims.width}×${dims.depth}×${dims.height}`,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('CreateDesignDialog', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('does not render when pendingCreateDesign is null', () => {
    render(<CreateDesignDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when pendingCreateDesign is set', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingCreateDesign: {
        binId: 'bin-1',
        defaultName: '2×3×5 Bin',
        dimensions: { width: 2, depth: 3, height: 5 },
        binLabel: 'Test Label',
      },
      hideCreateDesignDialog: vi.fn(),
    });

    render(<CreateDesignDialog />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('designLinking.createDialog.nameLabel')).toBeInTheDocument();
  });

  it('displays default name in input', async () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingCreateDesign: {
        binId: 'bin-1',
        defaultName: '2×3×5 Bin',
        dimensions: { width: 2, depth: 3, height: 5 },
      },
      hideCreateDesignDialog: vi.fn(),
    });

    render(<CreateDesignDialog />);
    const input = screen.getByLabelText('designLinking.createDialog.nameLabel');

    // Component uses queueMicrotask to set name, so wait for it
    await waitFor(() => {
      expect(input).toHaveValue('2×3×5 Bin');
    });
  });

  it('shows use label button when bin has label', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingCreateDesign: {
        binId: 'bin-1',
        defaultName: '2×3×5 Bin',
        dimensions: { width: 2, depth: 3, height: 5 },
        binLabel: 'My Custom Label',
      },
      hideCreateDesignDialog: vi.fn(),
    });

    render(<CreateDesignDialog />);
    expect(screen.getByText('designLinking.createDialog.useLabel')).toBeInTheDocument();
  });

  it('calls hideCreateDesignDialog on cancel', () => {
    const mockHide = vi.fn();
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingCreateDesign: {
        binId: 'bin-1',
        defaultName: '2×3×5 Bin',
        dimensions: { width: 2, depth: 3, height: 5 },
      },
      hideCreateDesignDialog: mockHide,
    });

    render(<CreateDesignDialog />);
    fireEvent.click(screen.getByText('common.cancel'));

    expect(mockHide).toHaveBeenCalled();
  });

  it('disables create button when name is empty', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingCreateDesign: {
        binId: 'bin-1',
        defaultName: '',
        dimensions: { width: 2, depth: 3, height: 5 },
      },
      hideCreateDesignDialog: vi.fn(),
    });

    render(<CreateDesignDialog />);
    const createButton = screen.getByText('designLinking.createDialog.create');
    expect(createButton).toBeDisabled();
  });

  it('displays dimensions in grid units', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingCreateDesign: {
        binId: 'bin-1',
        defaultName: '2×3×5 Bin',
        dimensions: { width: 2, depth: 3, height: 5 },
      },
      hideCreateDesignDialog: vi.fn(),
    });

    render(<CreateDesignDialog />);
    expect(screen.getByText(/2×3×5/)).toBeInTheDocument();
  });
});
