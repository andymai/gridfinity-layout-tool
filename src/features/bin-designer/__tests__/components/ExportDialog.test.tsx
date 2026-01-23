import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';

const mockDownloadSTL = vi.fn();

// Mock useExport hook
vi.mock('@/features/bin-designer/hooks/useExport', () => ({
  useExport: () => ({
    canExport: true,
    isExporting: false,
    estimates: {
      volumeMm3: 15000,
      gramsFilament: 18.6,
      metersFilament: 5.02,
      printTimeMinutes: 34,
      costUSD: 0.47,
    },
    fileName: 'gridfinity_2x2x3.stl',
    downloadSTL: mockDownloadSTL,
  }),
}));

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array(108), // 12 triangles
          normals: new Float32Array(108),
          error: null,
          timingMs: 10,
        },
        progress: 1,
      },
      ui: {
        activeTab: 'dimensions',
        exportDialogOpen: true,
        wireframeMode: false,
      },
    });
  });

  it('does not render when dialog is closed', () => {
    useDesignerStore.setState({
      ui: { activeTab: 'dimensions', exportDialogOpen: false, wireframeMode: false },
    });
    const { container } = render(<ExportDialog />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when dialog is open', () => {
    render(<ExportDialog />);
    expect(screen.getByText('Export Bin')).toBeInTheDocument();
  });

  it('shows format options with STL active', () => {
    render(<ExportDialog />);
    expect(screen.getByText('STL')).toBeInTheDocument();
    expect(screen.getByText('STEP')).toBeInTheDocument();
    expect(screen.getByText('3MF')).toBeInTheDocument();
  });

  it('shows file name preview', () => {
    render(<ExportDialog />);
    // The file name from generateFileName with default 2x2x3 params
    expect(screen.getByText(/gridfinity.*2x2x3/)).toBeInTheDocument();
  });

  it('shows print estimates', () => {
    render(<ExportDialog />);
    expect(screen.getByText('Filament')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('shows Download STL button', () => {
    render(<ExportDialog />);
    const button = screen.getByRole('button', { name: /download stl/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('triggers download on button click', () => {
    render(<ExportDialog />);
    const button = screen.getByRole('button', { name: /download stl/i });
    fireEvent.click(button);
    expect(mockDownloadSTL).toHaveBeenCalled();
  });

  it('closes on backdrop click', () => {
    render(<ExportDialog />);
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);

    // Verify store was updated
    expect(useDesignerStore.getState().ui.exportDialogOpen).toBe(false);
  });

  it('closes on close button click', () => {
    render(<ExportDialog />);
    const closeButton = screen.getByLabelText('Close export dialog');
    fireEvent.click(closeButton);
    expect(useDesignerStore.getState().ui.exportDialogOpen).toBe(false);
  });

  it('toggles name style between descriptive and compact', () => {
    render(<ExportDialog />);

    // Initially descriptive
    expect(screen.getByText(/gridfinity/)).toBeInTheDocument();

    // Click compact
    fireEvent.click(screen.getByText('Compact'));

    // Should show compact format
    expect(screen.getByText(/gf_/)).toBeInTheDocument();
  });

  it('shows triangle count', () => {
    render(<ExportDialog />);
    expect(screen.getByText('Triangles')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('has proper aria attributes', () => {
    render(<ExportDialog />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'export-dialog-title');
  });
});
