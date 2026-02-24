import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DesignerPage } from './DesignerPage';

// Mock child components
vi.mock('../ParameterPanel', () => ({
  ParameterPanel: () => <div data-testid="parameter-panel">Parameter Panel</div>,
}));

vi.mock('../PreviewCanvas', () => ({
  PreviewCanvas: () => <div data-testid="preview-canvas">Preview Canvas</div>,
}));

vi.mock('../ExportDialog', () => ({
  ExportDialog: () => <div data-testid="export-dialog">Export Dialog</div>,
}));

vi.mock('../DesignListDialog', () => ({
  DesignListDialog: () => <div data-testid="design-list-dialog">Design List Dialog</div>,
}));

// Mock hooks
vi.mock('../../hooks/useGeneration', () => ({
  useGeneration: vi.fn(),
}));

vi.mock('../../hooks/useDesignerInit', () => ({
  useDesignerInit: vi.fn(),
}));

vi.mock('../../hooks/useCreateFromBin', () => ({
  useCreateFromBin: vi.fn(),
}));

vi.mock('../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('../../hooks/useThumbnailCapture', () => ({
  useThumbnailCapture: vi.fn(),
}));

vi.mock('../../hooks/useDesignerUrlSync', () => ({
  useDesignerUrlSync: vi.fn(),
}));

vi.mock('../../hooks/useUnsavedWarning', () => ({
  useUnsavedWarning: vi.fn(),
}));

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isMobile: false, isTablet: false }),
}));

describe('DesignerPage', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      designName: 'Test Design',
      currentDesignId: null,
      saveStatus: 'idle',
      generation: {
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
      history: {
        past: [],
        future: [],
      },
      ui: {
        designListOpen: false,
        exportDialogOpen: false,
        previewCompartments: null,
        previewSelection: null,
      },
    });
  });

  it('renders without crashing', () => {
    render(<DesignerPage />);
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('shows design name in header', () => {
    render(<DesignerPage />);
    expect(screen.getByText('Test Design')).toBeInTheDocument();
  });

  it('renders undo and redo buttons', () => {
    render(<DesignerPage />);
    const undoButtons = screen.getAllByLabelText(/Undo/);
    const redoButtons = screen.getAllByLabelText(/Redo/);
    expect(undoButtons.length).toBeGreaterThan(0);
    expect(redoButtons.length).toBeGreaterThan(0);
  });

  it('disables undo button when no history', () => {
    render(<DesignerPage />);
    const undoButtons = screen.getAllByLabelText(/Undo/);
    undoButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('enables undo button when history exists', () => {
    useDesignerStore.setState({
      history: {
        past: [{ params: DEFAULT_BIN_PARAMS, mesh: null }],
        future: [],
      },
    });
    render(<DesignerPage />);
    const undoButtons = screen.getAllByLabelText(/Undo/);
    expect(undoButtons[0]).not.toBeDisabled();
  });

  it('shows save status when saving', () => {
    useDesignerStore.setState({
      saveStatus: 'saving',
    });
    render(<DesignerPage />);
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it('shows save status when saved', () => {
    useDesignerStore.setState({
      saveStatus: 'saved',
    });
    render(<DesignerPage />);
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it('shows save status when error', () => {
    useDesignerStore.setState({
      saveStatus: 'error',
    });
    render(<DesignerPage />);
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });
});
