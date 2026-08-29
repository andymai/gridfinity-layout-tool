import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_GENERATION_STATE,
  DEFAULT_UI_STATE,
} from '@/features/bin-designer/constants/defaults';
import { DEFAULT_LID_HINGE_CONFIG } from '@/features/bin-designer/types/lid';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '@/features/bin-designer/utils/fileNaming';
import { ok } from '@/core/result';
import type * as ToastStore from '@/core/store/toast';
import type * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import type * as SharedExportDialog from '@/shared/components/ExportDialog';

const mockDownloadBin = vi.fn().mockResolvedValue(undefined);
const mockDownloadSplit = vi.fn().mockResolvedValue(undefined);
const mockAddToast = vi.fn();
const mockOpenPublish = vi.fn();
const mockLoadDesign = vi.fn();
let mockShouldPromptSupport = false;
/** Split state the mocked hook reports; reset to "fits the bed" per test. */
let mockSplitState = { needsSplit: false, splitPieceCount: 1 };

vi.mock('@/core/store/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof ToastStore>();
  return {
    ...actual,
    useToastStore: Object.assign(
      (selector: (s: { addToast: typeof mockAddToast }) => unknown) =>
        selector({ addToast: mockAddToast }),
      { getState: () => ({ addToast: mockAddToast }) }
    ),
  };
});

vi.mock('@/features/bin-designer/hooks/useCommunityPublish', () => ({
  useCommunityPublishEntry: () => ({
    publishVisible: true,
    canPublish: true,
    openPublish: mockOpenPublish,
  }),
}));

vi.mock('@/features/bin-designer/storage/DesignerStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof DesignerStorage>();
  return { ...actual, loadDesign: (...args: unknown[]) => mockLoadDesign(...args) };
});

vi.mock('@/shared/components/ExportDialog', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedExportDialog>();
  return {
    ...actual,
    recordExportAndShouldPromptSupport: () => mockShouldPromptSupport,
  };
});

vi.mock('@/features/bin-designer/utils/designJson', () => ({
  downloadDesignAsFile: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useExport', () => ({
  useExport: () => ({
    canExport: true,
    engineReady: true,
    isExporting: false,
    isExportingBin: false,
    estimates: {
      volumeMm3: 15000,
      gramsFilament: 18.6,
      metersFilament: 5.02,
      printTimeMinutes: 34,
      costUSD: 0.47,
    },
    downloadBin: mockDownloadBin,
    downloadSplit: mockDownloadSplit,
    hasDividers: false,
    needsSplit: mockSplitState.needsSplit,
    splitPieceCount: mockSplitState.splitPieceCount,
    maxGridUnits: 6,
  }),
}));

function setupStore(overrides: Record<string, unknown> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS },
    designName: 'Untitled Bin',
    exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
    generation: {
      ...DEFAULT_GENERATION_STATE,
      status: 'complete',
      mesh: {
        vertices: new Float32Array(108),
        normals: new Float32Array(108),
        indices: new Uint32Array(36), // 12 triangles
        edgeVertices: new Float32Array(0),
        error: null,
        timingMs: 10,
      },
      progress: 1,
      epoch: 1,
    },
    ui: {
      ...DEFAULT_UI_STATE,
      exportDialogOpen: true,
      wireframeMode: false,
      designListOpen: false,
      halfGridMode: false,
    },
    ...overrides,
  });
}

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSplitState = { needsSplit: false, splitPieceCount: 1 };
    setupStore();
  });

  it('does not render when dialog is closed', () => {
    setupStore({
      ui: {
        ...DEFAULT_UI_STATE,
        exportDialogOpen: false,
        wireframeMode: false,
        designListOpen: false,
        halfGridMode: false,
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

  it('shows Download STL button by default', () => {
    render(<ExportDialog />);
    const button = screen.getByRole('button', { name: /download stl/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('triggers downloadBin with stl format on button click', async () => {
    render(<ExportDialog />);
    const button = screen.getByRole('button', { name: /download stl/i });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockDownloadBin).toHaveBeenCalledWith(
      'stl',
      expect.objectContaining({ style: 'descriptive' }),
      'Untitled Bin'
    );
  });

  it('shows format selector with STL, STEP, and 3MF options', () => {
    render(<ExportDialog />);
    expect(screen.getByText('STL')).toBeInTheDocument();
    expect(screen.getByText('STEP')).toBeInTheDocument();
    expect(screen.getByText('3MF')).toBeInTheDocument();
  });

  it('switches format to STEP and updates button text', () => {
    render(<ExportDialog />);

    fireEvent.click(screen.getByText('STEP'));

    // Store should be updated
    expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('step');
  });

  it('switches format to 3MF and updates file extension', () => {
    render(<ExportDialog />);

    fireEvent.click(screen.getByText('3MF'));

    expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('3mf');
  });

  it('closes on close button click', () => {
    render(<ExportDialog />);
    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);
    expect(useDesignerStore.getState().ui.exportDialogOpen).toBe(false);
  });

  it('toggles name style between descriptive and compact', () => {
    render(<ExportDialog />);

    // Initially descriptive
    expect(screen.getByText(/gridfinity/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Compact'));

    // Store should be updated
    expect(useDesignerStore.getState().exportFileNameConfig.style).toBe('compact');

    // Should show compact format
    expect(screen.getByText(/gf_/)).toBeInTheDocument();
  });

  it('switches to custom mode and shows editable input', () => {
    render(<ExportDialog />);

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
      exportFileNameConfig: { style: 'custom', customName: 'my-bin', format: 'stl' },
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
    // Dialog.Root generates a dynamic titleId — just verify it's set
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('shows all three style buttons', () => {
    render(<ExportDialog />);
    expect(screen.getByText('Descriptive')).toBeInTheDocument();
    expect(screen.getByText('Compact')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('switches to custom mode when clicking the file name display', () => {
    render(<ExportDialog />);

    // In descriptive mode, the file name display should be clickable
    const nameDisplay = screen.getByRole('button', { name: 'Custom file name' });
    expect(nameDisplay.tagName).toBe('SPAN');

    fireEvent.click(nameDisplay);

    // Should switch to custom mode with pre-filled name
    const config = useDesignerStore.getState().exportFileNameConfig;
    expect(config.style).toBe('custom');
    expect(config.customName).toBe('gridfinity_2x2x3');

    // Should now show editable input
    const input = screen.getByLabelText('Custom file name');
    expect(input.tagName).toBe('INPUT');
  });

  it('shows 3D Model section', () => {
    render(<ExportDialog />);

    // Check for section heading
    expect(screen.getByText('3D Model')).toBeInTheDocument();

    // Check for description
    expect(screen.getByText(/Export a printable 3D model file/i)).toBeInTheDocument();
  });

  it('format selector has proper radiogroup accessibility', () => {
    render(<ExportDialog />);
    const radiogroup = screen.getByRole('radiogroup', { name: 'Format' });
    expect(radiogroup).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);

    // Active radio (STL, second) has tabIndex 0, others have -1
    expect(radios[0]).toHaveAttribute('tabindex', '-1'); // 3MF
    expect(radios[1]).toHaveAttribute('tabindex', '0'); // STL (active)
    expect(radios[2]).toHaveAttribute('tabindex', '-1'); // STEP
  });

  it('format selector supports arrow key navigation', () => {
    render(<ExportDialog />);
    const radios = screen.getAllByRole('radio');

    // Active format starts as STL (index 1). ArrowRight → STEP
    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: 'ArrowRight' });
    expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('step');

    // Press ArrowRight again → should wrap to 3MF
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' });
    expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('3mf');

    // Press ArrowRight again → should select STL
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('stl');
  });

  describe('multi-color defaults', () => {
    function setupMultiColorOpen({
      open,
      multiColor,
      format,
      enabled = multiColor,
    }: {
      open: boolean;
      multiColor: boolean;
      format: 'stl' | 'step' | '3mf';
      /** Override the toggle independently of whether zone colors diverge. */
      enabled?: boolean;
    }) {
      const single = '#3b82f6';
      const featureColors = multiColor
        ? {
            enabled,
            body: single,
            lip: { corners: 1 as const, bands: 1 as const, cells: makeUniformLipCells('#ef4444') },
            labelTab: '#22c55e',
            base: single,
            scoop: single,
            dividers: single,
          }
        : {
            enabled,
            body: single,
            lip: { corners: 1 as const, bands: 1 as const, cells: makeUniformLipCells(single) },
            labelTab: single,
            base: single,
            scoop: single,
            dividers: single,
          };

      setupStore({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
          featureColors,
        },
        exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG, format },
        ui: {
          ...DEFAULT_UI_STATE,
          exportDialogOpen: open,
          wireframeMode: false,
          designListOpen: false,
          halfGridMode: false,
        },
      });
    }

    it('switches the format to 3MF when opening on a multi-color design saved as STL', () => {
      // Pre-open state: closed dialog, STL format.
      setupMultiColorOpen({ open: false, multiColor: true, format: 'stl' });
      const { rerender } = render(<ExportDialog />);

      // Now open the dialog (mimicking the user clicking the export button).
      act(() => {
        setupMultiColorOpen({ open: true, multiColor: true, format: 'stl' });
      });
      rerender(<ExportDialog />);

      expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('3mf');
    });

    it('does not change the format on open when the design is single-color', () => {
      setupMultiColorOpen({ open: false, multiColor: false, format: 'stl' });
      const { rerender } = render(<ExportDialog />);
      act(() => {
        setupMultiColorOpen({ open: true, multiColor: false, format: 'stl' });
      });
      rerender(<ExportDialog />);
      expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('stl');
    });

    it('disables STL and STEP radios when the design is multi-color', () => {
      setupMultiColorOpen({ open: true, multiColor: true, format: '3mf' });
      render(<ExportDialog />);
      expect(screen.getByRole('radio', { name: 'STL' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio', { name: 'STEP' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio', { name: '3MF' })).not.toHaveAttribute('aria-disabled');
    });

    it('does not auto-switch when multi-color is disabled on the design with diverged colors', () => {
      // Critical case: zone colors are diverged (red lip, green labelTab) but
      // featureColors.enabled is false. The toggle alone must suppress the
      // multi-color export path; underlying color data is preserved on disable.
      setupMultiColorOpen({ open: false, multiColor: true, format: 'stl', enabled: false });
      const { rerender } = render(<ExportDialog />);
      act(() => {
        setupMultiColorOpen({ open: true, multiColor: true, format: 'stl', enabled: false });
      });
      rerender(<ExportDialog />);
      expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('stl');
      expect(screen.getByRole('radio', { name: 'STL' })).not.toHaveAttribute('aria-disabled');
    });
  });

  // A mesh imprint is subtracted from the tessellated mesh, so there is no BREP
  // solid for STEP to carry and `binExporter` throws outright. Offering STEP
  // anyway turned a known limitation into a failed download and an auto-filed
  // issue.
  describe('mesh imprint cutouts', () => {
    function setupImprintOpen(open: boolean, format: 'stl' | 'step' | '3mf'): void {
      setupStore({
        params: {
          ...DEFAULT_BIN_PARAMS,
          cutouts: [
            {
              id: 'c1',
              shape: 'mesh',
              meshId: 'a1',
              x: 10,
              y: 10,
              width: 10,
              depth: 10,
              cutDepth: 5,
              rotation: 0,
              cornerRadius: 0,
              label: '',
              groupId: null,
            },
          ],
          meshAssets: {
            a1: {
              name: 'spanner',
              data: 'x',
              triangleCount: 12,
              sizeMm: { x: 10, y: 10, z: 5 },
              outlines: [],
            },
          },
        },
        exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG, format },
        ui: {
          ...DEFAULT_UI_STATE,
          exportDialogOpen: open,
          wireframeMode: false,
          designListOpen: false,
          halfGridMode: false,
        },
      });
    }

    it('disables the STEP radio and leaves STL and 3MF alone', () => {
      setupImprintOpen(true, 'stl');
      render(<ExportDialog />);
      expect(screen.getByRole('radio', { name: 'STEP' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio', { name: 'STL' })).not.toHaveAttribute('aria-disabled');
      expect(screen.getByRole('radio', { name: '3MF' })).not.toHaveAttribute('aria-disabled');
    });

    it('switches a design saved as STEP over to STL on open', () => {
      setupImprintOpen(false, 'step');
      const { rerender } = render(<ExportDialog />);
      act(() => setupImprintOpen(true, 'step'));
      rerender(<ExportDialog />);
      expect(useDesignerStore.getState().exportFileNameConfig.format).toBe('stl');
    });

    it('leaves STEP selectable when the only mesh cutout is hidden', () => {
      // `hidden` cutouts are not cut, so the solid is complete and STEP is
      // genuinely available — the gate has to track what gets subtracted, not
      // what is merely listed.
      setupImprintOpen(true, 'step');
      const params = useDesignerStore.getState().params;
      expect(params.cutouts).toHaveLength(1);
      act(() => {
        useDesignerStore.setState({
          params: { ...params, cutouts: [{ ...params.cutouts[0], hidden: true }] },
        });
      });
      render(<ExportDialog />);
      expect(screen.getByRole('radio', { name: 'STEP' })).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('oversized bin under STEP (#3501)', () => {
    beforeEach(() => {
      mockSplitState = { needsSplit: true, splitPieceCount: 4 };
      mockDownloadSplit.mockResolvedValue(true);
      setupStore({
        exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG, format: 'step' },
      });
    });

    it('offers the split checkbox, same as STL', () => {
      render(<ExportDialog />);
      expect(screen.getByLabelText(/split into pieces/i)).toBeInTheDocument();
      expect(screen.getByText(/exceeds your print bed/i)).toBeInTheDocument();
    });

    it('routes the download through downloadSplit, not downloadBin', async () => {
      render(<ExportDialog />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /download split step/i }));
      });
      expect(mockDownloadSplit).toHaveBeenCalledWith(
        'step',
        expect.objectContaining({ format: 'step' }),
        expect.anything()
      );
      expect(mockDownloadBin).not.toHaveBeenCalled();
    });

    it('names the download a ZIP — a split STEP is many files', () => {
      render(<ExportDialog />);
      expect(screen.getByText(/\.zip$/)).toBeInTheDocument();
    });
  });

  describe('hinge hardware', () => {
    it('quotes the pin the design needs, cut to length', () => {
      // The pin is hardware the user supplies, so it is a part of this design
      // and not a footnote — and it is the one number nobody can measure off
      // the model. Someone exporting at 11pm should not have to go and find it.
      setupStore({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 3,
          depth: 2,
          lid: {
            ...DEFAULT_BIN_PARAMS.lid,
            enabled: true,
            attachment: 'hinge',
            hinge: { ...DEFAULT_LID_HINGE_CONFIG },
          },
        },
      });
      render(<ExportDialog />);
      expect(screen.getByText(/filament offcut, cut to/)).toBeInTheDocument();
    });

    it('says nothing about pins for a lid that is not hinged', () => {
      setupStore();
      render(<ExportDialog />);
      expect(screen.queryByText(/filament offcut/)).not.toBeInTheDocument();
    });
  });

  describe('publish nudge', () => {
    beforeEach(() => {
      localStorage.clear();
      mockShouldPromptSupport = false;
      mockDownloadBin.mockResolvedValue(true);
      mockLoadDesign.mockResolvedValue(ok({ publishedId: undefined }));
      useDesignerStore.setState({ currentDesignId: 'design-1' });
    });

    async function download() {
      const view = render(<ExportDialog />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /download stl/i }));
      });
      return view;
    }

    it('offers to publish after a successful export', async () => {
      await download();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Nice bin. Share it with the community?',
          action: expect.objectContaining({ label: 'Publish it' }),
        })
      );
    });

    it('opens the publish dialog from the toast action', async () => {
      await download();
      const nudge = mockAddToast.mock.calls
        .map(([toast]) => toast)
        .find((toast) => toast.action !== undefined);
      nudge.action.onClick();
      expect(mockOpenPublish).toHaveBeenCalledTimes(1);
    });

    it('offers once, ever', async () => {
      const first = await download();
      mockAddToast.mockClear();
      first.unmount();

      // The export closed the dialog; a second export reopens it.
      setupStore({ currentDesignId: 'design-1' });
      await download();
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Nice bin. Share it with the community?' })
      );
    });

    it('stays quiet for a design that is already published', async () => {
      mockLoadDesign.mockResolvedValue(ok({ publishedId: 'Pub123456789' }));
      await download();
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Nice bin. Share it with the community?' })
      );
    });

    it('yields to the support prompt rather than stacking two asks', async () => {
      mockShouldPromptSupport = true;
      await download();
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Nice bin. Share it with the community?' })
      );
    });
  });
});

describe('ExportDialog — design JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSplitState = { needsSplit: false, splitPieceCount: 1 };
    setupStore();
  });

  it('offers the design JSON alongside the 3D formats', async () => {
    const { downloadDesignAsFile } = await import('@/features/bin-designer/utils/designJson');
    render(<ExportDialog />);
    const link = screen.getByRole('button', { name: 'Download Design JSON' });
    fireEvent.click(link);
    expect(downloadDesignAsFile).toHaveBeenCalledTimes(1);
    // Still open: the source file is usually taken alongside a 3D export.
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});
