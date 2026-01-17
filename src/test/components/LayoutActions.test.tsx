import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { LayoutActions } from '../../components/Modals/LayoutManagerModal/LayoutActions';
import type { LayoutEntry } from '../../types';

function createTestEntry(overrides: Partial<LayoutEntry> = {}): LayoutEntry {
  return {
    id: 'test-layout',
    name: 'Test Layout',
    createdAt: Date.now() - 1000000,
    modifiedAt: Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 5,
      layerCount: 1,
    },
    ...overrides,
  };
}

describe('LayoutActions', () => {
  const mockOnCopyLink = vi.fn();
  const mockOnDownload = vi.fn();
  const mockOnRename = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    entry: createTestEntry(),
    isOnlyLayout: false,
    onCopyLink: mockOnCopyLink,
    onDownload: mockOnDownload,
    onRename: mockOnRename,
    onDuplicate: mockOnDuplicate,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders copy link button', () => {
      render(<LayoutActions {...defaultProps} />);

      expect(screen.getByLabelText('Copy share link for Test Layout')).toBeInTheDocument();
    });

    it('renders download button', () => {
      render(<LayoutActions {...defaultProps} />);

      expect(screen.getByLabelText('Download Test Layout as JSON')).toBeInTheDocument();
    });

    it('renders overflow menu button', () => {
      render(<LayoutActions {...defaultProps} />);

      expect(screen.getByLabelText('More actions for Test Layout')).toBeInTheDocument();
    });
  });

  describe('icon button actions', () => {
    it('calls onCopyLink when copy button clicked', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Copy share link for Test Layout'));

      expect(mockOnCopyLink).toHaveBeenCalledOnce();
    });

    it('calls onDownload when download button clicked', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Download Test Layout as JSON'));

      expect(mockOnDownload).toHaveBeenCalledOnce();
    });

    it('stops propagation on icon button click', () => {
      const parentClickHandler = vi.fn();

      render(
        <div onClick={parentClickHandler}>
          <LayoutActions {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByLabelText('Copy share link for Test Layout'));

      // The parent should not receive the click
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('overflow menu', () => {
    it('opens menu when overflow button clicked', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('shows rename option', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));

      expect(screen.getByRole('menuitem', { name: /Rename/ })).toBeInTheDocument();
    });

    it('shows duplicate option', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));

      expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toBeInTheDocument();
    });

    it('shows delete option when not only layout', () => {
      render(<LayoutActions {...defaultProps} isOnlyLayout={false} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));

      expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    });

    it('hides delete option when only layout', () => {
      render(<LayoutActions {...defaultProps} isOnlyLayout={true} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));

      expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    });

    it('calls onRename when rename clicked', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));

      expect(mockOnRename).toHaveBeenCalledOnce();
    });

    it('calls onDuplicate when duplicate clicked', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));

      expect(mockOnDuplicate).toHaveBeenCalledOnce();
    });

    it('closes menu after action', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes menu when clicking overflow button again', () => {
      render(<LayoutActions {...defaultProps} />);

      // Open menu
      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Close menu
      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('delete confirmation', () => {
    it('shows confirmation state on first delete click', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

      expect(screen.getByText('Click to confirm')).toBeInTheDocument();
    });

    it('shows bin count in confirmation when bins exist', () => {
      render(
        <LayoutActions
          {...defaultProps}
          entry={createTestEntry({ preview: { ...defaultProps.entry.preview, binCount: 5 } })}
        />
      );

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

      expect(screen.getByText(/5 bins will be deleted/)).toBeInTheDocument();
    });

    it('shows singular bin message when 1 bin', () => {
      render(
        <LayoutActions
          {...defaultProps}
          entry={createTestEntry({ preview: { ...defaultProps.entry.preview, binCount: 1 } })}
        />
      );

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

      expect(screen.getByText(/1 bin will be deleted/)).toBeInTheDocument();
    });

    it('calls onDelete on second delete click', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      // First click - enters confirmation
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
      // Second click - confirms
      fireEvent.click(screen.getByText('Click to confirm'));

      expect(mockOnDelete).toHaveBeenCalledOnce();
    });

    it('does not show confirmation for layouts with 0 bins', () => {
      render(
        <LayoutActions
          {...defaultProps}
          entry={createTestEntry({ preview: { ...defaultProps.entry.preview, binCount: 0 } })}
        />
      );

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

      expect(screen.queryByText(/bins will be deleted/)).not.toBeInTheDocument();
    });
  });

  describe('click outside', () => {
    it('closes menu when clicking outside', async () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Simulate click outside via mousedown
      await act(async () => {
        fireEvent.mouseDown(document.body);
      });

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('resets confirmation state when clicking outside', async () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
      expect(screen.getByText('Click to confirm')).toBeInTheDocument();

      // Click outside
      await act(async () => {
        fireEvent.mouseDown(document.body);
      });

      // Reopen menu - should not be in confirmation state
      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));
      expect(screen.queryByText('Click to confirm')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('overflow button has aria-expanded false when closed', () => {
      render(<LayoutActions {...defaultProps} />);

      const button = screen.getByLabelText('More actions for Test Layout');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('overflow button has aria-expanded true when open', () => {
      render(<LayoutActions {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('More actions for Test Layout'));

      const button = screen.getByLabelText('More actions for Test Layout');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('overflow button has aria-haspopup', () => {
      render(<LayoutActions {...defaultProps} />);

      const button = screen.getByLabelText('More actions for Test Layout');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
    });
  });
});
