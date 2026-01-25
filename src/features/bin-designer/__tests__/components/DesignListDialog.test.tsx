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
    expect(screen.getByText('My Designs')).toBeInTheDocument();
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

  it('highlights the currently active design', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    // The active design should not have a "Load" button
    const loadButtons = screen.getAllByRole('button', { name: /load/i });
    // Only Screw Bin (design-2) should have Load since design-1 is current
    expect(loadButtons).toHaveLength(1);
    expect(loadButtons[0]).toHaveAttribute('aria-label', 'Load Screw Bin');
  });

  it('loads a design and closes dialog', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load Screw Bin' }));

    expect(useDesignerStore.getState().currentDesignId).toBe('design-2');
    expect(useDesignerStore.getState().designName).toBe('Screw Bin');
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

  it('deletes a design from the list', async () => {
    const DesignerStorage = await import('@/features/bin-designer/storage/DesignerStorage');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Screw Bin' }));

    await waitFor(() => {
      expect(DesignerStorage.deleteDesign).toHaveBeenCalledWith('design-2');
      expect(screen.queryByText('Screw Bin')).not.toBeInTheDocument();
    });
  });

  it('starts inline rename on rename button click', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rename Tool Holder' }));

    const input = screen.getByRole('textbox', { name: 'Design name' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Tool Holder');
  });

  it('closes on backdrop click', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalled();
  });

  it('closes on close button click', async () => {
    render(<DesignListDialog open={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows thumbnail when design has one', async () => {
    const { container } = render(<DesignListDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Screw Bin')).toBeInTheDocument();
    });

    const img = container.querySelector('img[src="data:image/png;base64,abc"]');
    expect(img).toBeInTheDocument();
  });
});
