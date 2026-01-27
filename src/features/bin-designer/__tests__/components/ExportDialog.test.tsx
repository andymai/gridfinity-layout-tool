import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '@/features/bin-designer/utils/fileNaming';

const mockDownloadSTL = vi.fn().mockResolvedValue(undefined);

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
    downloadSTL: mockDownloadSTL,
  }),
}));

function setupStore(overrides: Record<string, unknown> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    designName: 'Untitled Bin',
    exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
    generation: {
      status: 'complete',
      mesh: {
        vertices: new Float32Array(108), // 12 triangles
        normals: new Float32Array(108),
        error: null,
        timingMs: 10,
      },
      progress: 1,
      epoch: 1,
    },
    ui: {
      activeTab: 'dimensions',
      exportDialogOpen: true,
      wireframeMode: false,
      designListOpen: false,
      halfBinMode: false,
    },
    ...overrides,
  });
}

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('does not render when dialog is closed', () => {
    setupStore({
      ui: {
        activeTab: 'dimensions',
        exportDialogOpen: false,
        wireframeMode: false,
        designListOpen: false,
        halfBinMode: false,
      },
    });
    const { container } = render(<ExportDialog />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when dialog is open', () => {
    render(<ExportDialog />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows file name preview in descriptive mode', () => {
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

  it('triggers download with config on button click', () => {
    render(<ExportDialog />);
    const button = screen.getByRole('button', { name: /download stl/i });
    fireEvent.click(button);
    expect(mockDownloadSTL).toHaveBeenCalledWith(
      { style: 'descriptive', customName: '' },
      'Untitled Bin'
    );
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
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(useDesignerStore.getState().ui.exportDialogOpen).toBe(false);
  });

  it('toggles name style between descriptive and compact', () => {
    render(<ExportDialog />);

    // Initially descriptive
    expect(screen.getByText(/gridfinity/)).toBeInTheDocument();

    // Click compact
    fireEvent.click(screen.getByText('Compact'));

    // Store should be updated
    expect(useDesignerStore.getState().exportFileNameConfig.style).toBe('compact');

    // Should show compact format
    expect(screen.getByText(/gf_/)).toBeInTheDocument();
  });

  it('switches to custom mode and shows editable input', () => {
    render(<ExportDialog />);

    // Click custom
    fireEvent.click(screen.getByText('Custom'));

    // Store should be updated to custom with pre-filled name
    const config = useDesignerStore.getState().exportFileNameConfig;
    expect(config.style).toBe('custom');
    expect(config.customName).toBe('gridfinity_2x2x3');

    // Should show editable input
    const input = screen.getByLabelText('Custom file name');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('gridfinity_2x2x3');
  });

  it('updates custom name on input change', () => {
    setupStore({
      exportFileNameConfig: { style: 'custom', customName: 'my-bin' },
    });
    render(<ExportDialog />);

    const input = screen.getByLabelText('Custom file name');
    fireEvent.change(input, { target: { value: 'new-bin-name' } });

    expect(useDesignerStore.getState().exportFileNameConfig.customName).toBe('new-bin-name');
  });

  it('uses design name as prefix when set', () => {
    setupStore({ designName: 'Screwdriver Bin' });
    render(<ExportDialog />);

    // Should show design name as prefix in descriptive mode
    expect(screen.getByText(/Screwdriver Bin_2x2x3/)).toBeInTheDocument();
  });

  it('falls back to gridfinity prefix when design is Untitled Bin', () => {
    setupStore({ designName: 'Untitled Bin' });
    render(<ExportDialog />);

    expect(screen.getByText(/gridfinity_2x2x3/)).toBeInTheDocument();
  });

  it('shows the format extension separately', () => {
    render(<ExportDialog />);
    expect(screen.getByText('.stl')).toBeInTheDocument();
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

  it('shows all three style buttons', () => {
    render(<ExportDialog />);
    expect(screen.getByText('Descriptive')).toBeInTheDocument();
    expect(screen.getByText('Compact')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
