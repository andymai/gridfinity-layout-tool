import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockedResizeDialog } from './BlockedResizeDialog';
import { resetAllStores } from '@/test/testUtils';
import { useLinkingStore } from '../../../store';

vi.mock('../../../store');

vi.mock('../../../hooks', () => ({
  useBinLinking: () => ({
    editLinkedDesign: vi.fn(),
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('BlockedResizeDialog', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '';

    vi.mocked(useLinkingStore).mockReturnValue({
      pendingBlockedResize: null,
      hideBlockedResizeDialog: vi.fn(),
    });
  });

  it('does not render when pendingBlockedResize is null', () => {
    render(<BlockedResizeDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when pendingBlockedResize is set', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingBlockedResize: {
        binId: 'bin-1',
        designId: 'design-1',
        designName: 'My Custom Bin',
        reasons: ['inserts'],
      },
      hideBlockedResizeDialog: vi.fn(),
    });

    render(<BlockedResizeDialog />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays the design name in the description', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingBlockedResize: {
        binId: 'bin-1',
        designId: 'design-1',
        designName: 'My Custom Bin',
        reasons: ['inserts'],
      },
      hideBlockedResizeDialog: vi.fn(),
    });

    render(<BlockedResizeDialog />);
    expect(
      screen.getByText('designLinking.blockedResize.description:{"name":"My Custom Bin"}')
    ).toBeInTheDocument();
  });

  it('displays all complexity reasons', () => {
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingBlockedResize: {
        binId: 'bin-1',
        designId: 'design-1',
        designName: 'Test',
        reasons: ['inserts', 'cutouts', 'non-default-compartments'],
      },
      hideBlockedResizeDialog: vi.fn(),
    });

    render(<BlockedResizeDialog />);
    expect(screen.getByText('designLinking.blockedResize.reasons.inserts')).toBeInTheDocument();
    expect(screen.getByText('designLinking.blockedResize.reasons.cutouts')).toBeInTheDocument();
    expect(
      screen.getByText('designLinking.blockedResize.reasons.compartments')
    ).toBeInTheDocument();
  });

  it('calls hideBlockedResizeDialog on dismiss', () => {
    const hideFn = vi.fn();
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingBlockedResize: {
        binId: 'bin-1',
        designId: 'design-1',
        designName: 'Test',
        reasons: ['inserts'],
      },
      hideBlockedResizeDialog: hideFn,
    });

    render(<BlockedResizeDialog />);
    fireEvent.click(screen.getByText('common.dismiss'));
    expect(hideFn).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const hideFn = vi.fn();
    vi.mocked(useLinkingStore).mockReturnValue({
      pendingBlockedResize: {
        binId: 'bin-1',
        designId: 'design-1',
        designName: 'Test',
        reasons: ['cutouts'],
      },
      hideBlockedResizeDialog: hideFn,
    });

    render(<BlockedResizeDialog />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(hideFn).toHaveBeenCalled();
  });
});
