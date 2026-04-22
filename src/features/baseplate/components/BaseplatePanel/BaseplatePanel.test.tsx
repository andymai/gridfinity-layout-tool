import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseplatePanel } from './BaseplatePanel';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), key);
    }
    return key;
  },
}));

// Mock layout store
const mockSetBaseplateParams = vi.fn();
const mockSetPrintBedSize = vi.fn();
let mockLayoutState = {
  layout: {
    drawer: { width: 4, depth: 6 },
    gridUnitMm: 42,
    printBedSize: 256,
    baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
  },
  setBaseplateParams: mockSetBaseplateParams,
  setPrintBedSize: mockSetPrintBedSize,
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (state: typeof mockLayoutState) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockLayoutState);
    }
    return mockLayoutState;
  },
}));

// Give useLayoutStore a getState
const { useLayoutStore } = await import('@/core/store/layout');
(useLayoutStore as unknown as { getState: () => typeof mockLayoutState }).getState = () =>
  mockLayoutState;

// Mock settings store (for filament color picker)
const mockUpdateSetting = vi.fn();
vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: { baseplateFilamentColor: '#d4d8dc' },
      updateSetting: mockUpdateSetting,
    }),
}));

// Mock half-bin mode store
let mockHalfBinMode = false;
vi.mock('@/core/store/halfBinMode', () => ({
  useHalfBinModeStore: (selector: (state: { halfBinMode: boolean }) => unknown) =>
    selector({ halfBinMode: mockHalfBinMode }),
  INITIAL_HALF_BIN_MODE_STATE: {},
}));

// Mock page store
let mockTiling: unknown = null;
let mockSplitViewMode = 'assembled';
let mockHoveredPieceLabel: string | null = null;
let mockSelectedPieceLabel: string | null = null;
const mockSetSplitViewMode = vi.fn();
const mockSetHoveredPieceLabel = vi.fn();
const mockSetSelectedPieceLabel = vi.fn();

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      tiling: mockTiling,
      splitViewMode: mockSplitViewMode,
      hoveredPieceLabel: mockHoveredPieceLabel,
      selectedPieceLabel: mockSelectedPieceLabel,
      setSplitViewMode: mockSetSplitViewMode,
      setHoveredPieceLabel: mockSetHoveredPieceLabel,
      setSelectedPieceLabel: mockSetSelectedPieceLabel,
    };
    return selector(state);
  },
}));

const splitTiling = {
  isSplit: true,
  cols: 2,
  rows: 1,
  pieces: [
    { label: 'A1', col: 0, row: 0, widthUnits: 5, depthUnits: 4, gridOffsetX: 0, gridOffsetY: 0 },
    { label: 'B1', col: 1, row: 0, widthUnits: 4, depthUnits: 4, gridOffsetX: 5, gridOffsetY: 0 },
  ],
  totalWidthUnits: 9,
  totalDepthUnits: 6,
  stackCount: 1,
  stackSeparatorThickness: 0,
};

describe('BaseplatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutState = {
      layout: {
        drawer: { width: 4, depth: 6 },
        gridUnitMm: 42,
        printBedSize: 256,
        baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
      },
      setBaseplateParams: mockSetBaseplateParams,
      setPrintBedSize: mockSetPrintBedSize,
    };
    mockHalfBinMode = false;
    mockTiling = null;
    mockSplitViewMode = 'assembled';
    mockHoveredPieceLabel = null;
    mockSelectedPieceLabel = null;
  });

  it('renders dimensions section with steppers and click-to-edit mm summary (no padding)', () => {
    render(<BaseplatePanel />);
    // Steppers carry grid units; mm summary lives below them as the click-to-edit target
    expect(screen.getByRole('textbox', { name: 'baseplate.gridWidth' })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: 'baseplate.gridDepth' })).toHaveValue('6');
    const editBtn = screen.getByRole('button', { name: 'baseplate.editDimensions' });
    expect(editBtn).toHaveTextContent(/168\s*×\s*252\s*mm/);
  });

  it('mm summary reflects total when padding is set', () => {
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 5,
      paddingRight: 3,
    };
    render(<BaseplatePanel />);
    // Total: 168 (grid) + 5 + 3 (padding) = 176 wide, 252 deep
    const editBtn = screen.getByRole('button', { name: 'baseplate.editDimensions' });
    expect(editBtn).toHaveTextContent(/176\s*×\s*252\s*mm/);
  });

  it('hides the "incl. padding" note when all padding is zero', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.inclPadding')).toBeNull();
  });

  it('shows the "incl. padding" note when any padding side is non-zero', () => {
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 4,
    };
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.inclPadding')).toBeInTheDocument();
  });

  it('shows the "incl. padding" note when only back padding is non-zero', () => {
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingBack: 2.5,
    };
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.inclPadding')).toBeInTheDocument();
  });

  it('renders print settings section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionPrintSettings')).toBeInTheDocument();
  });

  it('renders unified dimensions section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionDimensions')).toBeInTheDocument();
  });

  it('renders base section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionBase')).toBeInTheDocument();
  });

  it('does not render view strip when tiling is null', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.splitInfo')).not.toBeInTheDocument();
  });

  it('renders view strip when tiling is split', () => {
    mockTiling = splitTiling;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.splitInfo')).toBeInTheDocument();
    expect(screen.getByText('baseplate.splitReason')).toBeInTheDocument();
    // Mini-map buttons exist for each piece
    const pieceButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
    expect(pieceButtons.length).toBe(2);
  });

  it('renders magnet toggle as switch', () => {
    render(<BaseplatePanel />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders print bed size stepper', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.printBedSize')).toBeInTheDocument();
  });

  describe('mini-map interaction', () => {
    it('renders mini-map cells as buttons with aria-label', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const buttons = screen.getAllByRole('button', { pressed: false });
      const pieceButtons = buttons.filter((b) =>
        b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel')
      );
      expect(pieceButtons.length).toBe(2);
      expect(pieceButtons[0].tagName).toBe('BUTTON');
    });

    it('calls setHoveredPieceLabel on pointer enter/leave', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const pieceButtons = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
      const a1Button = pieceButtons[0];
      fireEvent.pointerEnter(a1Button);
      expect(mockSetHoveredPieceLabel).toHaveBeenCalledWith('A1');
      fireEvent.pointerLeave(a1Button);
      expect(mockSetHoveredPieceLabel).toHaveBeenCalledWith(null);
    });

    it('calls setSelectedPieceLabel on click (toggle)', () => {
      mockTiling = splitTiling;
      render(<BaseplatePanel />);
      const pieceButtons = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('baseplate.pieceLabel'));
      const a1Button = pieceButtons[0];
      fireEvent.click(a1Button);
      expect(mockSetSelectedPieceLabel).toHaveBeenCalledWith('A1');
    });

    it('deselects on click when already selected', () => {
      mockTiling = splitTiling;
      mockSelectedPieceLabel = 'A1';
      render(<BaseplatePanel />);
      const a1Button = screen.getByText('A1');
      fireEvent.click(a1Button);
      expect(mockSetSelectedPieceLabel).toHaveBeenCalledWith(null);
    });
  });

  describe('sync with layout toggle', () => {
    it('renders sync-with-layout checkbox checked by default', () => {
      render(<BaseplatePanel />);
      expect(screen.getByText('baseplate.syncWithLayout')).toBeInTheDocument();
      const checkbox = screen.getByRole('checkbox', { name: 'baseplate.syncWithLayout' });
      expect(checkbox).toBeChecked();
    });

    it('renders width/depth steppers disabled when synced with layout', () => {
      render(<BaseplatePanel />);
      const widthStepper = screen.getByRole('textbox', { name: 'baseplate.gridWidth' });
      const depthStepper = screen.getByRole('textbox', { name: 'baseplate.gridDepth' });
      expect(widthStepper).toBeDisabled();
      expect(depthStepper).toBeDisabled();
    });

    it('shows drawer values in steppers when synced with layout', () => {
      render(<BaseplatePanel />);
      const widthStepper = screen.getByRole('textbox', { name: 'baseplate.gridWidth' });
      const depthStepper = screen.getByRole('textbox', { name: 'baseplate.gridDepth' });
      expect(widthStepper).toHaveValue('4');
      expect(depthStepper).toHaveValue('6');
    });

    it('enables steppers when sync-with-layout is unchecked', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        syncWithLayout: false,
        baseplateWidth: 8,
        baseplateDepth: 10,
      };
      render(<BaseplatePanel />);
      const checkbox = screen.getByRole('checkbox', { name: 'baseplate.syncWithLayout' });
      expect(checkbox).not.toBeChecked();
      const widthStepper = screen.getByRole('textbox', { name: 'baseplate.gridWidth' });
      const depthStepper = screen.getByRole('textbox', { name: 'baseplate.gridDepth' });
      expect(widthStepper).not.toBeDisabled();
      expect(depthStepper).not.toBeDisabled();
      expect(widthStepper).toHaveValue('8');
      expect(depthStepper).toHaveValue('10');
    });

    it('initializes custom dims from drawer when unchecking sync-with-layout', () => {
      render(<BaseplatePanel />);
      const checkbox = screen.getByRole('checkbox', { name: 'baseplate.syncWithLayout' });
      fireEvent.click(checkbox);
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          syncWithLayout: false,
          baseplateWidth: 4,
          baseplateDepth: 6,
        })
      );
    });

    it('sets syncWithLayout true when re-checking sync-with-layout', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        syncWithLayout: false,
        baseplateWidth: 8,
        baseplateDepth: 10,
      };
      render(<BaseplatePanel />);
      const checkbox = screen.getByRole('checkbox', { name: 'baseplate.syncWithLayout' });
      fireEvent.click(checkbox);
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ syncWithLayout: true })
      );
    });
  });

  describe('editable dimensions', () => {
    it('renders editable dimension button in no-padding mode', () => {
      render(<BaseplatePanel />);
      const editBtn = screen.getByRole('button', { name: 'baseplate.editDimensions' });
      expect(editBtn).toHaveTextContent(/168\s*×\s*252\s*mm/);
    });

    it('enters edit mode on click and shows two inputs', () => {
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
      expect(screen.getByLabelText('baseplate.editDimensionsWidth')).toBeInTheDocument();
      expect(screen.getByLabelText('baseplate.editDimensionsDepth')).toBeInTheDocument();
    });

    it('commits mm values, snaps grid, distributes padding, and unchecks sync', () => {
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));

      const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
      const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');

      // Enter 500mm wide × 300mm deep (halfBinMode=false, step=1)
      // 500 / 42 = 11.90 → floor to 11 units = 462mm, remainder = 38mm → 19 each
      // 300 / 42 = 7.14 → floor to 7 = 294mm, remainder = 6mm → 3 each
      fireEvent.change(widthInput, { target: { value: '500' } });
      fireEvent.change(depthInput, { target: { value: '300' } });
      fireEvent.keyDown(depthInput, { key: 'Enter' });

      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          syncWithLayout: false,
          baseplateWidth: 11,
          baseplateDepth: 7,
          paddingLeft: 19,
          paddingRight: 19,
          paddingFront: 3,
          paddingBack: 3,
        })
      );
    });

    it('renders editable dimension button in with-padding mode', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        paddingLeft: 5,
        paddingRight: 3,
      };
      render(<BaseplatePanel />);
      const editBtn = screen.getByRole('button', { name: 'baseplate.editDimensions' });
      // Total: 168 (grid) + 5 + 3 (padding) = 176mm wide
      expect(editBtn).toHaveTextContent(/176\s*×\s*252\s*mm/);
    });

    it('exact grid multiple produces zero padding', () => {
      // 420 / 42 = exactly 10 units → no remainder
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
      const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
      const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
      fireEvent.change(widthInput, { target: { value: '420' } });
      fireEvent.change(depthInput, { target: { value: '252' } });
      fireEvent.keyDown(depthInput, { key: 'Enter' });

      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          baseplateWidth: 10,
          baseplateDepth: 6,
          paddingLeft: 0,
          paddingRight: 0,
          paddingFront: 0,
          paddingBack: 0,
        })
      );
    });

    it('half-bin mode snaps to 0.5 increments', () => {
      mockHalfBinMode = true;
      // 450 / 42 = 10.71 → floor to 10.5 (step=0.5) = 441mm, remainder = 9mm → 4.5 each
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
      const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
      const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
      fireEvent.change(widthInput, { target: { value: '450' } });
      fireEvent.change(depthInput, { target: { value: '252' } });
      fireEvent.keyDown(depthInput, { key: 'Enter' });

      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          baseplateWidth: 10.5,
          paddingLeft: 4.5,
          paddingRight: 4.5,
        })
      );
    });

    it('clamps grid to GRID_MIN when mm value is very small', () => {
      // 10mm / 42 = 0.24 → floor to 0 but clamped to GRID_MIN (0.5)
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
      const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
      const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
      fireEvent.change(widthInput, { target: { value: '21' } });
      fireEvent.change(depthInput, { target: { value: '21' } });
      fireEvent.keyDown(depthInput, { key: 'Enter' });

      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          baseplateWidth: 0.5,
          baseplateDepth: 0.5,
        })
      );
    });

    it('clamps grid to GRID_MAX when mm value is very large', () => {
      // 2200 / 42 = 52.38 → floor to 52 but clamped to GRID_MAX (50)
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
      const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
      const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
      fireEvent.change(widthInput, { target: { value: '2200' } });
      fireEvent.change(depthInput, { target: { value: '252' } });
      fireEvent.keyDown(depthInput, { key: 'Enter' });

      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          baseplateWidth: 50,
          // remainder: 2200 - 50*42 = 2200 - 2100 = 100mm → 50 each
          paddingLeft: 50,
          paddingRight: 50,
        })
      );
    });

    it('small remainder distributes fractional padding evenly', () => {
      // 43 / 42 = 1.024 → floor to 1 unit = 42mm, remainder = 1mm → 0.5 each
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
      const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
      const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
      fireEvent.change(widthInput, { target: { value: '43' } });
      fireEvent.change(depthInput, { target: { value: '42' } });
      fireEvent.keyDown(depthInput, { key: 'Enter' });

      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({
          baseplateWidth: 1,
          paddingLeft: 0.5,
          paddingRight: 0.5,
          paddingFront: 0,
          paddingBack: 0,
        })
      );
    });
  });

  describe('padding schematic', () => {
    it('renders all four padding steppers in spatial layout', () => {
      render(<BaseplatePanel />);
      expect(screen.getByLabelText('baseplate.paddingBack')).toBeInTheDocument();
      expect(screen.getByLabelText('baseplate.paddingFront')).toBeInTheDocument();
      expect(screen.getByLabelText('baseplate.paddingLeft')).toBeInTheDocument();
      expect(screen.getByLabelText('baseplate.paddingRight')).toBeInTheDocument();
    });

    it('side stepper increment updates padding value', () => {
      render(<BaseplatePanel />);
      const incBtn = screen.getByLabelText('baseplate.paddingLeft increment');
      fireEvent.click(incBtn);
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ paddingLeft: 0.25 })
      );
    });

    it('side stepper decrement is disabled at minimum', () => {
      render(<BaseplatePanel />);
      const decBtn = screen.getByLabelText('baseplate.paddingLeft decrement');
      expect(decBtn).toBeDisabled();
      fireEvent.click(decBtn);
      expect(mockSetBaseplateParams).not.toHaveBeenCalled();
    });

    it('side stepper input commits value on blur', () => {
      render(<BaseplatePanel />);
      const input = screen.getByLabelText('baseplate.paddingLeft');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '5.5' } });
      fireEvent.blur(input);
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ paddingLeft: 5.5 })
      );
    });

    it('side stepper Escape cancels edit without committing', () => {
      render(<BaseplatePanel />);
      const input = screen.getByLabelText('baseplate.paddingLeft');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(mockSetBaseplateParams).not.toHaveBeenCalled();
    });

    it('side stepper Enter commits exactly once', () => {
      render(<BaseplatePanel />);
      const input = screen.getByLabelText('baseplate.paddingRight');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      // Enter commits once, blur should not commit again
      const calls = mockSetBaseplateParams.mock.calls.filter(
        (c: unknown[]) => (c[0] as Record<string, number>).paddingRight === 7
      );
      expect(calls).toHaveLength(1);
    });
  });
});
