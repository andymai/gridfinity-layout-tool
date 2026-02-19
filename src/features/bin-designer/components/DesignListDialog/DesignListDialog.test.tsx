import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignListDialog } from '@/features/bin-designer/components/DesignListDialog';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { ok } from '@/core/result';
import type { SavedDesign } from '@/features/bin-designer/types';

vi.mock('@/features/bin-designer/storage/DesignerStorage');

const mockDesigns: SavedDesign[] = [
  {
    id: 'design-1',
    name: 'Tool Holder',
    params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2 },
    thumbnail: null,
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-22T12:00:00.000Z',
  },
  {
    id: 'design-2',
    name: 'Screw Bin',
    params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 6 },
    thumbnail: 'data:image/png;base64,abc',
    createdAt: '2026-01-19T08:00:00.000Z',
    updatedAt: '2026-01-21T15:00:00.000Z',
  },
];

describe('DesignListDialog', () => {
  const onClose = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: 'design-1',
      designName: 'Tool Holder',
    });

    // Set up the mock for listDesigns
    const DesignerStorage = await import('@/features/bin-designer/storage/DesignerStorage');
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok(mockDesigns));
    vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(ok(undefined));
    vi.mocked(DesignerStorage.duplicateDesign).mockResolvedValue(
      ok({ ...mockDesigns[0], id: 'design-3', name: 'Copy of Tool Holder' })
    );
    vi.mocked(DesignerStorage.saveDesign).mockResolvedValue(
      ok({ ...mockDesigns[0], name: 'Renamed' })
    );
  });

  it('renders nothing when closed', () => {
    const { container } = render(<DesignListDialog open={false} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with header when open', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Saved Designs')).toBeInTheDocument();
    expect(screen.getByText('New Design')).toBeInTheDocument();
  });

  it('loads and displays saved designs', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });
  });

  it('shows empty state when no designs exist', async () => {
    const DesignerStorage = await import('@/features/bin-designer/storage/DesignerStorage');
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok([]));

    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('No saved designs yet')).toBeInTheDocument();
    });
  });

  it('highlights the currently active design with badge', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    // The active design should have an "Active" badge
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('loads a design by clicking on the item', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    // Click on the design item itself to load it
    fireEvent.click(screen.getByText('Screw Bin'));

    expect(useDesignerStore.getState().currentDesignId).toBe('design-2');
    expect(useDesignerStore.getState().designName).toBe('Screw Bin');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes dialog when clicking the active design', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    // Click on the active design - should just close the dialog
    fireEvent.click(screen.getByText('Tool Holder'));

    // Should stay on the same design but close
    expect(useDesignerStore.getState().currentDesignId).toBe('design-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('creates new design and closes dialog', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Design'));

    expect(useDesignerStore.getState().currentDesignId).toBeNull();
    expect(useDesignerStore.getState().designName).toBe('Untitled Bin');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens overflow menu and shows actions', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    // Find and click the overflow menu button for Screw Bin
    const moreButtons = screen.getAllByRole('button', { name: /more actions/i });
    expect(moreButtons.length).toBeGreaterThan(0);

    // Click the menu button for the second design (Screw Bin)
    fireEvent.click(moreButtons[1]); // Second design's menu

    // The menu should show Load, Download JSON, Rename, Duplicate, Delete options
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /^load$/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /download json/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });
  });

  it('duplicates a design via overflow menu', async () => {
    const DesignerStorage = await import('@/features/bin-designer/storage/DesignerStorage');
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    // Open overflow menu for first design
    const moreButtons = screen.getAllByRole('button', { name: /more actions/i });
    fireEvent.click(moreButtons[0]);

    // Click duplicate
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }));

    await waitFor(() => {
      expect(DesignerStorage.duplicateDesign).toHaveBeenCalledWith('design-1');
    });
  });

  it('deletes a design with two-click confirmation', async () => {
    const DesignerStorage = await import('@/features/bin-designer/storage/DesignerStorage');
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    // Open overflow menu for Screw Bin
    const moreButtons = screen.getAllByRole('button', { name: /more actions/i });
    fireEvent.click(moreButtons[1]);

    // First click - shows confirmation
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Second click - confirms deletion
    await waitFor(() => {
      expect(screen.getByText(/click again to delete/i)).toBeInTheDocument();
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(DesignerStorage.deleteDesign).toHaveBeenCalledWith('design-2');
    });
  });

  it('starts inline rename via overflow menu', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    // Open overflow menu
    const moreButtons = screen.getAllByRole('button', { name: /more actions/i });
    fireEvent.click(moreButtons[0]);

    // Click rename
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    // Check that an input appeared with the current name
    const input = screen.getByRole('textbox', { name: 'Design name' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Tool Holder');
  });

  it('closes on backdrop click', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    // Click the backdrop (role="presentation") directly, not the dialog
    fireEvent.click(screen.getByRole('presentation'));

    expect(onClose).toHaveBeenCalled();
  });

  it('closes on close button click', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders isometric SVG thumbnails for designs', async () => {
    const { container } = render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    // The new UI uses SVG isometric thumbnails instead of img tags
    const svgThumbnails = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgThumbnails.length).toBeGreaterThan(0);
  });

  it('shows design dimensions in list', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    // Should show dimensions like "3×2×3u" (width×depth×height)
    // Tool Holder: width=3, depth=2, height=3 (from DEFAULT_BIN_PARAMS)
    expect(screen.getByText(/3×2×3u/)).toBeInTheDocument();
    // Screw Bin: width=1, depth=1, height=6
    expect(screen.getByText(/1×1×6u/)).toBeInTheDocument();
  });

  it('renders all designs when there are more than 9 saved', async () => {
    const manyDesigns: SavedDesign[] = Array.from({ length: 12 }, (_, i) => ({
      id: `design-${i + 1}`,
      name: `Design ${i + 1}`,
      params: { ...DEFAULT_BIN_PARAMS, width: i + 1 },
      thumbnail: null,
      createdAt: '2026-01-20T10:00:00.000Z',
      updatedAt: new Date(2026, 0, 20 + i).toISOString(),
      exportFileNameConfig: null,
    }));

    const DesignerStorage = await import('@/features/bin-designer/storage/DesignerStorage');
    vi.mocked(DesignerStorage.listDesigns).mockResolvedValue(ok(manyDesigns));

    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Design 1')).toBeInTheDocument();
    });

    // All 12 designs should be in the DOM (scrollable, not clipped)
    for (let i = 1; i <= 12; i++) {
      expect(screen.getByText(`Design ${i}`)).toBeInTheDocument();
    }

    // The content wrapper must be a flex column to ensure the scroll chain works
    const dialog = screen.getByRole('dialog');
    const contentWrapper = dialog.querySelector('[aria-busy]');
    expect(contentWrapper).toHaveClass('flex', 'flex-col');
  });

  describe('Import flow', () => {
    it('shows Import button in header', async () => {
      render(<DesignListDialog open={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Tool Holder')).toBeInTheDocument();
      });

      // Import button should be visible in the header
      expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    });

    it('shows import view when Import button is clicked', async () => {
      render(<DesignListDialog open={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Tool Holder')).toBeInTheDocument();
      });

      // Click the Import button
      fireEvent.click(screen.getByRole('button', { name: 'Import' }));

      // Import view should appear with paste prompt text
      await waitFor(() => {
        expect(screen.getByText('or paste design JSON')).toBeInTheDocument();
      });

      // Textarea should be present
      expect(screen.getByPlaceholderText('or paste design JSON')).toBeInTheDocument();

      // Design list should no longer be visible
      expect(screen.queryByText('Tool Holder')).not.toBeInTheDocument();
      expect(screen.queryByText('Screw Bin')).not.toBeInTheDocument();
    });

    it('returns to design list when cancel is clicked in import view', async () => {
      render(<DesignListDialog open={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Tool Holder')).toBeInTheDocument();
      });

      // Click Import button to show import view
      fireEvent.click(screen.getByRole('button', { name: 'Import' }));

      await waitFor(() => {
        expect(screen.getByText('or paste design JSON')).toBeInTheDocument();
      });

      // Click Cancel button in the import view
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Design list should be visible again
      await waitFor(() => {
        expect(screen.getByText('Tool Holder')).toBeInTheDocument();
        expect(screen.getByText('Screw Bin')).toBeInTheDocument();
      });

      // Import view should be gone
      expect(screen.queryByPlaceholderText('or paste design JSON')).not.toBeInTheDocument();
    });
  });
});
