import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteDesignWarningDialog } from './DeleteDesignWarningDialog';
import { resetAllStores } from '@/test/testUtils';
import { useLinkingStore } from '../../../store';

// Mock stores
vi.mock('../../../store', () => ({
  useLinkingStore: vi.fn(() => ({
    pendingDeleteWarning: null,
    hideDeleteWarning: vi.fn(),
  })),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('DeleteDesignWarningDialog', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('does not render when pendingDeleteWarning is null', () => {
    render(<DeleteDesignWarningDialog />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders dialog when pendingDeleteWarning is set', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    vi.mocked(useLinkingStore).mockReturnValue({
      pendingDeleteWarning: {
        designName: 'Test Design',
        linkedBinIds: ['bin-1', 'bin-2'],
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
      },
      hideDeleteWarning: vi.fn(),
    });

    render(<DeleteDesignWarningDialog />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('displays design name', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingDeleteWarning: {
        designName: 'My Custom Design',
        linkedBinIds: ['bin-1'],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
      hideDeleteWarning: vi.fn(),
    });

    render(<DeleteDesignWarningDialog />);
    expect(screen.getByText('My Custom Design')).toBeInTheDocument();
  });

  it('shows warning icon', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingDeleteWarning: {
        designName: 'Test Design',
        linkedBinIds: ['bin-1'],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
      hideDeleteWarning: vi.fn(),
    });

    render(<DeleteDesignWarningDialog />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('calls onCancel and hides dialog on cancel', () => {
    const mockOnCancel = vi.fn();
    const mockHideWarning = vi.fn();

    vi.mocked(useLinkingStore).mockReturnValue({
      pendingDeleteWarning: {
        designName: 'Test Design',
        linkedBinIds: ['bin-1'],
        onConfirm: vi.fn(),
        onCancel: mockOnCancel,
      },
      hideDeleteWarning: mockHideWarning,
    });

    render(<DeleteDesignWarningDialog />);
    fireEvent.click(screen.getByText('common.cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockHideWarning).toHaveBeenCalled();
  });

  it('calls onConfirm and hides dialog on confirm', () => {
    const mockOnConfirm = vi.fn();
    const mockHideWarning = vi.fn();

    vi.mocked(useLinkingStore).mockReturnValue({
      pendingDeleteWarning: {
        designName: 'Test Design',
        linkedBinIds: ['bin-1', 'bin-2'],
        onConfirm: mockOnConfirm,
        onCancel: vi.fn(),
      },
      hideDeleteWarning: mockHideWarning,
    });

    render(<DeleteDesignWarningDialog />);
    fireEvent.click(screen.getByText('designLinking.deleteWarning.confirm'));

    expect(mockOnConfirm).toHaveBeenCalled();
    expect(mockHideWarning).toHaveBeenCalled();
  });

  it('displays linked bins count', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingDeleteWarning: {
        designName: 'Test Design',
        linkedBinIds: ['bin-1', 'bin-2', 'bin-3'],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
      hideDeleteWarning: vi.fn(),
    });

    render(<DeleteDesignWarningDialog />);
    expect(screen.getByText(/designLinking.deleteWarning.linkedBinsCount/)).toBeInTheDocument();
  });
});
