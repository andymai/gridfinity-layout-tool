import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncDimensionsDialog } from './SyncDimensionsDialog';
import { resetAllStores } from '@/test/testUtils';
import { useLinkingStore } from '../../../store';

// Mock stores and hooks
vi.mock('../../../store');

vi.mock('../../../hooks', () => ({
  useBinLinking: () => ({
    executeSyncFromDesign: vi.fn(),
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

describe('SyncDimensionsDialog', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '';

    // Default mock for useLinkingStore
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: null,
      hideSyncDialog: vi.fn(),
      declineSyncDialog: vi.fn(),
    });
  });

  it('does not render when pendingSync is null', () => {
    render(<SyncDimensionsDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when pendingSync is set', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: {
        designName: 'Test Design',
        designId: 'design-1',
        binIds: ['bin-1', 'bin-2'],
        comparison: {
          design: { width: 2, depth: 3, height: 5 },
          bin: { width: 2, depth: 3, height: 4 },
        },
        eligibility: [
          { binId: 'bin-1', canSync: true },
          { binId: 'bin-2', canSync: true },
        ],
        binsHaveVaryingDimensions: false,
      },
      hideSyncDialog: vi.fn(),
      declineSyncDialog: vi.fn(),
    });

    render(<SyncDimensionsDialog />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays design name', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: {
        designName: 'My Custom Design',
        designId: 'design-1',
        binIds: ['bin-1'],
        comparison: {
          design: { width: 2, depth: 3, height: 5 },
          bin: { width: 2, depth: 3, height: 5 },
        },
        eligibility: [{ binId: 'bin-1', canSync: true }],
        binsHaveVaryingDimensions: false,
      },
      hideSyncDialog: vi.fn(),
      declineSyncDialog: vi.fn(),
    });

    render(<SyncDimensionsDialog />);
    expect(screen.getByText(/My Custom Design/)).toBeInTheDocument();
  });

  it('shows dimension comparison', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: {
        designName: 'Test Design',
        designId: 'design-1',
        binIds: ['bin-1'],
        comparison: {
          design: { width: 2, depth: 3, height: 5 },
          bin: { width: 2, depth: 3, height: 4 },
        },
        eligibility: [{ binId: 'bin-1', canSync: true }],
        binsHaveVaryingDimensions: false,
      },
      hideSyncDialog: vi.fn(),
      declineSyncDialog: vi.fn(),
    });

    render(<SyncDimensionsDialog />);
    expect(screen.getByText(/2×3×5/)).toBeInTheDocument();
    expect(screen.getByText(/2×3×4/)).toBeInTheDocument();
  });

  it('shows bins to update count', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: {
        designName: 'Test Design',
        designId: 'design-1',
        binIds: ['bin-1', 'bin-2'],
        comparison: {
          design: { width: 2, depth: 3, height: 5 },
          bin: { width: 2, depth: 3, height: 4 },
        },
        eligibility: [
          { binId: 'bin-1', canSync: true },
          { binId: 'bin-2', canSync: true },
        ],
        binsHaveVaryingDimensions: false,
      },
      hideSyncDialog: vi.fn(),
      declineSyncDialog: vi.fn(),
    });

    render(<SyncDimensionsDialog />);
    expect(screen.getByText(/designLinking.syncDialog.binsToUpdate/)).toBeInTheDocument();
  });

  it('shows bins to unlink count when some bins cannot sync', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: {
        designName: 'Test Design',
        designId: 'design-1',
        binIds: ['bin-1', 'bin-2', 'bin-3'],
        comparison: {
          design: { width: 2, depth: 3, height: 5 },
          bin: { width: 2, depth: 3, height: 4 },
        },
        eligibility: [
          { binId: 'bin-1', canSync: true },
          { binId: 'bin-2', canSync: false },
          { binId: 'bin-3', canSync: false },
        ],
        binsHaveVaryingDimensions: true,
      },
      hideSyncDialog: vi.fn(),
      declineSyncDialog: vi.fn(),
    });

    render(<SyncDimensionsDialog />);
    expect(screen.getByText(/designLinking.syncDialog.binsToUnlink/)).toBeInTheDocument();
  });

  it('records the decline on cancel rather than just closing (#3040)', () => {
    // Cancel has to be remembered: the mount reconciliation re-checks every
    // linked design, so a plain close re-opened this prompt on every return to
    // the layout editor.
    const mockHide = vi.fn();
    const mockDecline = vi.fn();
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingSync: {
        designName: 'Test Design',
        designId: 'design-1',
        binIds: ['bin-1'],
        comparison: {
          design: { width: 2, depth: 3, height: 5 },
          bin: { width: 2, depth: 3, height: 5 },
        },
        eligibility: [{ binId: 'bin-1', canSync: true }],
        binsHaveVaryingDimensions: false,
      },
      hideSyncDialog: mockHide,
      declineSyncDialog: mockDecline,
    });

    render(<SyncDimensionsDialog />);
    fireEvent.click(screen.getByText('common.cancel'));

    expect(mockDecline).toHaveBeenCalled();
    expect(mockHide).not.toHaveBeenCalled();
  });
});
