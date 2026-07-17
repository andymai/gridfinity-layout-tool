import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseplatePanel } from './BaseplatePanel';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import type { BaseplateTiling } from '../../types/tiling';
import { cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import type { CornerCutParams } from '@/core/types';

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
const mockSetMagnetAnchor = vi.fn();
let mockLayoutState = {
  layout: {
    drawer: { width: 4, depth: 6 },
    gridUnitMm: 42,
    magnetAnchor: undefined as 'edge' | 'center' | undefined,
    printBedSize: 256,
    baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
  },
  setBaseplateParams: mockSetBaseplateParams,
  setPrintBedSize: mockSetPrintBedSize,
  setMagnetAnchor: mockSetMagnetAnchor,
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

// Mock cloud_sync feature flag — these tests don't exercise the UserDock,
// so keep it disabled to avoid pulling in session/sync store dependencies.
vi.mock('@/shared/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));

// Mock half-bin mode store
let mockHalfGridMode = false;
vi.mock('@/core/store/halfGridMode', () => ({
  useHalfGridModeStore: (selector: (state: { halfGridMode: boolean }) => unknown) =>
    selector({ halfGridMode: mockHalfGridMode }),
  INITIAL_HALF_GRID_MODE_STATE: {},
}));

// Mock page store
let mockTiling: unknown = null;
let mockSplitViewMode = 'assembled';
let mockHoveredPieceLabel: string | null = null;
let mockSelectedPieceLabel: string | null = null;
let mockExportFormat: 'stl' | 'step' | '3mf' = 'stl';
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
      exportFileNameConfig: { style: 'descriptive', customName: '', format: mockExportFormat },
      setSplitViewMode: mockSetSplitViewMode,
      setHoveredPieceLabel: mockSetHoveredPieceLabel,
      setSelectedPieceLabel: mockSetSelectedPieceLabel,
    };
    return selector(state);
  },
}));

const splitTiling: BaseplateTiling = {
  isSplit: true,
  cols: 2,
  rows: 1,
  pieces: [
    {
      label: 'A1',
      col: 0,
      row: 0,
      widthUnits: 5,
      depthUnits: 4,
      gridOffsetX: 0,
      gridOffsetY: 0,
      placementRotationDeg: 0,
    },
    {
      label: 'B1',
      col: 1,
      row: 0,
      widthUnits: 4,
      depthUnits: 4,
      gridOffsetX: 5,
      gridOffsetY: 0,
      placementRotationDeg: 0,
    },
  ],
  totalWidthUnits: 9,
  totalDepthUnits: 6,
  stackCount: 1,
  stackSeparatorThickness: 0,
  bedLoads: 1,
};

describe('BaseplatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutState = {
      layout: {
        drawer: { width: 4, depth: 6 },
        gridUnitMm: 42,
        magnetAnchor: undefined,
        printBedSize: 256,
        baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
      },
      setBaseplateParams: mockSetBaseplateParams,
      setPrintBedSize: mockSetPrintBedSize,
      setMagnetAnchor: mockSetMagnetAnchor,
    };
    mockHalfGridMode = false;
    mockTiling = null;
    mockSplitViewMode = 'assembled';
    mockHoveredPieceLabel = null;
    mockSelectedPieceLabel = null;
    mockExportFormat = 'stl';
  });

  it('renders dimensions section with steppers and click-to-edit mm summary (no padding)', () => {
    render(<BaseplatePanel />);
    // Steppers carry grid units; mm summary lives below them as the click-to-edit target
    expect(screen.getByRole('spinbutton', { name: 'baseplate.gridWidth' })).toHaveValue(4);
    expect(screen.getByRole('spinbutton', { name: 'baseplate.gridDepth' })).toHaveValue(6);
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

  it('renders physical units section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('common.physicalUnits')).toBeInTheDocument();
  });

  describe('magnet anchor toggle (#2525)', () => {
    it('is hidden at the standard 42mm grid (edge and center are identical there)', () => {
      render(<BaseplatePanel />);
      expect(screen.queryByText('baseplate.magnetAnchor')).toBeNull();
    });

    it('appears once the grid unit exceeds 42mm', () => {
      mockLayoutState.layout.gridUnitMm = 50;
      render(<BaseplatePanel />);
      expect(screen.getByText('baseplate.magnetAnchor')).toBeInTheDocument();
      expect(screen.getByText('baseplate.magnetAnchorEdge')).toBeInTheDocument();
      expect(screen.getByText('baseplate.magnetAnchorCenter')).toBeInTheDocument();
    });

    it('shows the corners caption by default (progressive disclosure of the choice)', () => {
      mockLayoutState.layout.gridUnitMm = 50;
      render(<BaseplatePanel />);
      expect(screen.getByText('baseplate.magnetAnchorHintCorners')).toBeInTheDocument();
      expect(screen.queryByText('baseplate.magnetAnchorHintLegacy')).toBeNull();
    });

    it('swaps to the legacy caption when the legacy anchor is active', () => {
      mockLayoutState.layout.gridUnitMm = 50;
      mockLayoutState.layout.magnetAnchor = 'center';
      render(<BaseplatePanel />);
      expect(screen.getByText('baseplate.magnetAnchorHintLegacy')).toBeInTheDocument();
      expect(screen.queryByText('baseplate.magnetAnchorHintCorners')).toBeNull();
    });

    it('dispatches setMagnetAnchor when the legacy option is chosen', () => {
      mockLayoutState.layout.gridUnitMm = 50;
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByText('baseplate.magnetAnchorCenter'));
      expect(mockSetMagnetAnchor).toHaveBeenCalledWith('center');
    });
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
    expect(screen.getByRole('switch', { name: /magnet/i })).toBeInTheDocument();
  });

  describe('connector fit offset (issue #2024)', () => {
    beforeEach(() => {
      mockTiling = splitTiling;
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: true,
      };
    });

    it('renders the Connector fit stepper only when connectors are enabled', () => {
      render(<BaseplatePanel />);
      expect(screen.getByLabelText('baseplate.connectorFit.label')).toHaveTextContent('0');
    });

    it('hides the Connector fit stepper when connectors are disabled', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: false,
      };
      render(<BaseplatePanel />);
      expect(screen.queryByLabelText('baseplate.connectorFit.label')).not.toBeInTheDocument();
    });

    it('steps the offset up by one 0.05mm increment', () => {
      render(<BaseplatePanel />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Increase baseplate.connectorFit.label' })
      );
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ connectorFitOffset: 0.05 })
      );
    });

    it('steps the offset down into negative (tighter) territory', () => {
      render(<BaseplatePanel />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Decrease baseplate.connectorFit.label' })
      );
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ connectorFitOffset: -0.05 })
      );
    });

    it('clears the offset back to undefined when stepping returns to zero', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: true,
        connectorFitOffset: 0.05,
      };
      render(<BaseplatePanel />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Decrease baseplate.connectorFit.label' })
      );
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ connectorFitOffset: undefined })
      );
    });

    it('renders a signed mm display for a non-zero offset', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: true,
        connectorFitOffset: 0.1,
      };
      render(<BaseplatePanel />);
      expect(screen.getByLabelText('baseplate.connectorFit.label')).toHaveTextContent('+0.1');
    });
  });

  describe('connectors selector', () => {
    beforeEach(() => {
      mockTiling = splitTiling;
    });

    it('shows "none" when connectors are disabled', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: false,
      };
      render(<BaseplatePanel />);
      expect(screen.getByRole('radio', { name: 'baseplate.connectors.none' })).toBeChecked();
    });

    it('reflects the active connector style when enabled', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: true,
        connectorStyle: 'snapClip',
      };
      render(<BaseplatePanel />);
      expect(
        screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' })
      ).toBeChecked();
    });

    it('disables connectors when "none" is selected', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: true,
        connectorStyle: 'snapClip',
      };
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('radio', { name: 'baseplate.connectors.none' }));
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ connectorNubs: false, connectorStyle: undefined })
      );
    });

    it('enables connectors and sets the style when a style is picked', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: false,
      };
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' }));
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ connectorNubs: true, connectorStyle: 'snapClip' })
      );
    });

    it('stores plain dovetail as undefined style', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: false,
      };
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('radio', { name: 'baseplate.connectorStyle.dovetail' }));
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ connectorNubs: true, connectorStyle: undefined })
      );
    });

    describe('while vertical stacking', () => {
      const stacking = { enabled: true, gapMm: 0.2 } as const;

      it('keeps the connector picker reachable but hides magnets and corner radius', () => {
        mockLayoutState.layout.baseplateParams = {
          ...DEFAULT_BASEPLATE_PARAMS,
          connectorNubs: true,
          stackPrint: stacking,
        };
        render(<BaseplatePanel />);
        expect(
          screen.getByRole('radio', { name: 'baseplate.connectorStyle.dovetail' })
        ).toBeChecked();
        expect(screen.queryByText('baseplate.magnetHoles')).toBeNull();
        expect(screen.queryByText('baseplate.cornerRadius')).toBeNull();
      });

      it('disables the snap clip option with a reason', () => {
        mockLayoutState.layout.baseplateParams = {
          ...DEFAULT_BASEPLATE_PARAMS,
          connectorNubs: true,
          connectorStyle: 'dovetailKey',
          stackPrint: stacking,
        };
        render(<BaseplatePanel />);
        expect(
          screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' })
        ).toBeDisabled();
        expect(screen.getByText('baseplate.connectors.snapClipNoStack')).toBeInTheDocument();
      });

      it('shows snap clip as effectively none (it is stripped while stacking)', () => {
        mockLayoutState.layout.baseplateParams = {
          ...DEFAULT_BASEPLATE_PARAMS,
          connectorNubs: true,
          connectorStyle: 'snapClip',
          stackPrint: stacking,
        };
        render(<BaseplatePanel />);
        expect(screen.getByRole('radio', { name: 'baseplate.connectors.none' })).toBeChecked();
        expect(
          screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' })
        ).not.toBeChecked();
      });

      it('keeps magnets and corner radius for STEP exports (STEP never stacks)', () => {
        mockExportFormat = 'step';
        mockLayoutState.layout.baseplateParams = {
          ...DEFAULT_BASEPLATE_PARAMS,
          stackPrint: stacking,
        };
        render(<BaseplatePanel />);
        expect(screen.getByText('baseplate.magnetHoles')).toBeInTheDocument();
        expect(screen.getByText('baseplate.cornerRadius')).toBeInTheDocument();
      });
    });
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
      const widthStepper = screen.getByRole('spinbutton', { name: 'baseplate.gridWidth' });
      const depthStepper = screen.getByRole('spinbutton', { name: 'baseplate.gridDepth' });
      expect(widthStepper).toBeDisabled();
      expect(depthStepper).toBeDisabled();
    });

    it('shows drawer values in steppers when synced with layout', () => {
      render(<BaseplatePanel />);
      const widthStepper = screen.getByRole('spinbutton', { name: 'baseplate.gridWidth' });
      const depthStepper = screen.getByRole('spinbutton', { name: 'baseplate.gridDepth' });
      expect(widthStepper).toHaveValue(4);
      expect(depthStepper).toHaveValue(6);
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
      const widthStepper = screen.getByRole('spinbutton', { name: 'baseplate.gridWidth' });
      const depthStepper = screen.getByRole('spinbutton', { name: 'baseplate.gridDepth' });
      expect(widthStepper).not.toBeDisabled();
      expect(depthStepper).not.toBeDisabled();
      expect(widthStepper).toHaveValue(8);
      expect(depthStepper).toHaveValue(10);
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

      // Enter 500mm wide × 300mm deep (halfGridMode=false, step=1)
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
      mockHalfGridMode = true;
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
      // Mock returns 'baseplate.increasePadding' (key) since the key string has no {label}
      // placeholder to substitute with the ariaLabel param. Real translations have it.
      const incBtns = screen.getAllByLabelText('baseplate.increasePadding');
      // Four padding sides (back, front, left, right), pick the first to verify wiring
      fireEvent.click(incBtns[0]);
      expect(mockSetBaseplateParams).toHaveBeenCalled();
    });

    it('side stepper decrement is disabled at minimum', () => {
      render(<BaseplatePanel />);
      const decBtns = screen.getAllByLabelText('baseplate.decreasePadding');
      // All four padding values are 0 by default, so all decrement buttons are disabled
      decBtns.forEach((btn) => expect(btn).toBeDisabled());
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

  describe('reset to defaults', () => {
    it('renders the reset-to-defaults button', () => {
      render(<BaseplatePanel />);
      expect(screen.getByRole('button', { name: 'baseplate.reset' })).toBeInTheDocument();
    });

    it('marks the button as a help-jump target so help search can deep-link to it', () => {
      render(<BaseplatePanel />);
      const button = screen.getByRole('button', { name: 'baseplate.reset' });
      expect(button.closest('[data-help-target="bp-reset"]')).not.toBeNull();
    });

    it('does not reset immediately — it opens a confirmation first', () => {
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.reset' }));
      expect(mockSetBaseplateParams).not.toHaveBeenCalled();
      expect(screen.getByText('baseplate.resetConfirmTitle')).toBeInTheDocument();
    });

    it('restores DEFAULT_BASEPLATE_PARAMS after confirming', () => {
      mockLayoutState.layout.baseplateParams = {
        ...DEFAULT_BASEPLATE_PARAMS,
        magnetHoles: true,
        paddingLeft: 10,
        connectorNubs: true,
        connectorStyle: 'snapClip',
      };
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.reset' }));
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.resetConfirmButton' }));
      expect(mockSetBaseplateParams).toHaveBeenCalledWith({ ...DEFAULT_BASEPLATE_PARAMS });
    });

    it('does not reset when the confirmation is cancelled', () => {
      render(<BaseplatePanel />);
      fireEvent.click(screen.getByRole('button', { name: 'baseplate.reset' }));
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
      expect(mockSetBaseplateParams).not.toHaveBeenCalled();
    });
  });

  describe('margin fill mode', () => {
    // A tileable margin (>= 8mm) so the grid/half-grid segments are enabled.
    const withPadding = (extra: Partial<typeof DEFAULT_BASEPLATE_PARAMS> = {}) => ({
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 21,
      ...extra,
    });

    const fillToggle = () => screen.getByRole('switch', { name: 'baseplate.overTile' });
    const halfGridBox = () => screen.getByRole('checkbox', { name: 'baseplate.preferHalfGrid' });
    const leftoverGroup = () =>
      screen.queryByRole('radiogroup', { name: 'baseplate.leftoverLabel' });
    const leftoverSolid = () => screen.getByRole('radio', { name: 'baseplate.leftoverSolid' });
    const leftoverGrid = () => screen.getByRole('radio', { name: 'baseplate.leftoverGrid' });

    it('defaults to solid padding when over-tile is off', () => {
      mockLayoutState.layout.baseplateParams = withPadding();
      render(<BaseplatePanel />);
      expect(fillToggle()).not.toBeChecked();
      // The half-grid sub-option is hidden until the fill toggle is on.
      expect(
        screen.queryByRole('checkbox', { name: 'baseplate.preferHalfGrid' })
      ).not.toBeInTheDocument();
    });

    it('reflects plain over-tile', () => {
      mockLayoutState.layout.baseplateParams = withPadding({ overTile: true });
      render(<BaseplatePanel />);
      expect(fillToggle()).toBeChecked();
      expect(halfGridBox()).not.toBeChecked();
    });

    it('reflects half-grid fill', () => {
      mockLayoutState.layout.baseplateParams = withPadding({
        overTile: true,
        overTileHalfGrid: true,
      });
      render(<BaseplatePanel />);
      expect(fillToggle()).toBeChecked();
      expect(halfGridBox()).toBeChecked();
    });

    it('enables plain over-tile with no half-grid flag', () => {
      mockLayoutState.layout.baseplateParams = withPadding();
      render(<BaseplatePanel />);
      fireEvent.click(fillToggle());
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ overTile: true, overTileHalfGrid: undefined })
      );
    });

    it('enables half-grid fill', () => {
      // Half-grid is a sub-option of the fill toggle, so start with fill on.
      mockLayoutState.layout.baseplateParams = withPadding({ overTile: true });
      render(<BaseplatePanel />);
      fireEvent.click(halfGridBox());
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ overTile: true, overTileHalfGrid: true })
      );
    });

    it('returns to solid padding', () => {
      mockLayoutState.layout.baseplateParams = withPadding({
        overTile: true,
        overTileHalfGrid: true,
      });
      render(<BaseplatePanel />);
      fireEvent.click(fillToggle());
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ overTile: false, overTileHalfGrid: undefined })
      );
    });

    it('hides the leftover Grid/Solid control until half-grid is on', () => {
      mockLayoutState.layout.baseplateParams = withPadding({ overTile: true });
      render(<BaseplatePanel />);
      expect(leftoverGroup()).not.toBeInTheDocument();
    });

    it('shows the leftover control on Grid by default when half-grid is on', () => {
      mockLayoutState.layout.baseplateParams = withPadding({
        overTile: true,
        overTileHalfGrid: true,
      });
      render(<BaseplatePanel />);
      expect(leftoverGroup()).toBeInTheDocument();
      expect(leftoverGrid()).toBeChecked();
      expect(leftoverSolid()).not.toBeChecked();
    });

    it('reflects the stored solid-leftover choice', () => {
      mockLayoutState.layout.baseplateParams = withPadding({
        overTile: true,
        overTileHalfGrid: true,
        overTileHalfGridSolidLeftover: true,
      });
      render(<BaseplatePanel />);
      expect(leftoverSolid()).toBeChecked();
    });

    it('switches the leftover to solid', () => {
      mockLayoutState.layout.baseplateParams = withPadding({
        overTile: true,
        overTileHalfGrid: true,
      });
      render(<BaseplatePanel />);
      fireEvent.click(leftoverSolid());
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ overTileHalfGridSolidLeftover: true })
      );
    });

    it('clears the leftover flag to undefined when switching back to grid', () => {
      // Default Grid stores undefined (not false) so identical geometry keeps
      // one serialized/cache identity.
      mockLayoutState.layout.baseplateParams = withPadding({
        overTile: true,
        overTileHalfGrid: true,
        overTileHalfGridSolidLeftover: true,
      });
      render(<BaseplatePanel />);
      fireEvent.click(leftoverGrid());
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ overTileHalfGridSolidLeftover: undefined })
      );
    });

    it('disables turning on the fill toggle when every margin is below the tile threshold', () => {
      mockLayoutState.layout.baseplateParams = withPadding({ paddingLeft: 3 });
      render(<BaseplatePanel />);
      expect(fillToggle()).toBeDisabled();
    });

    it('keeps the fill toggle enabled (so it can be turned off) when fill is on but padding shrank', () => {
      // overTile already enabled, but no edge can fit a tile anymore.
      mockLayoutState.layout.baseplateParams = withPadding({ paddingLeft: 3, overTile: true });
      render(<BaseplatePanel />);
      const toggle = fillToggle();
      expect(toggle).toBeChecked();
      expect(toggle).not.toBeDisabled();
      fireEvent.click(toggle);
      expect(mockSetBaseplateParams).toHaveBeenCalledWith(
        expect.objectContaining({ overTile: false, overTileHalfGrid: undefined })
      );
    });
  });
});

describe('shaped drawer (outline present)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutState = {
      layout: {
        drawer: { width: 4, depth: 6 },
        gridUnitMm: 42,
        magnetAnchor: undefined,
        printBedSize: 256,
        baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
      },
      setBaseplateParams: mockSetBaseplateParams,
      setPrintBedSize: mockSetPrintBedSize,
      setMagnetAnchor: mockSetMagnetAnchor,
    };
    mockExportFormat = 'stl';
  });

  const U = 42;
  const L_OUTLINE = {
    vertices: [
      { x: 0, y: 0 },
      { x: 4 * U, y: 0 },
      { x: 4 * U, y: 3 * U },
      { x: 2 * U, y: 3 * U },
      { x: 2 * U, y: 6 * U },
      { x: 0, y: 6 * U },
    ],
  };

  it('hides padding controls and shows the shaped notice', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: L_OUTLINE } as never;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.shapedDrawerNotice')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.padding')).toBeNull();
  });

  it('keeps padding controls for unsynced (custom-size) plates', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: L_OUTLINE } as never;
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      syncWithLayout: false,
    };
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.shapedDrawerNotice')).toBeNull();
    expect(screen.getByText('baseplate.padding')).toBeInTheDocument();
  });

  it('keeps padding controls when stack printing wins over the shape', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: L_OUTLINE } as never;
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, gapMm: 0.2 },
    } as never;
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.shapedDrawerNotice')).toBeNull();
  });

  it('shows the shaped notice for STEP even with stacking stored on', () => {
    // STEP clears stackPrint before buildFullParams, so the exported solid IS
    // shaped — the panel must follow the format-aware stackEnabled signal.
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: L_OUTLINE } as never;
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, gapMm: 0.2 },
    } as never;
    mockExportFormat = 'step';
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.shapedDrawerNotice')).toBeInTheDocument();
  });
});

describe('corner-cut shaped drawer (padding composes, issue #2612)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLayoutState = {
      layout: {
        drawer: { width: 4, depth: 6 },
        gridUnitMm: 42,
        magnetAnchor: undefined,
        printBedSize: 256,
        baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
      },
      setBaseplateParams: mockSetBaseplateParams,
      setPrintBedSize: mockSetPrintBedSize,
      setMagnetAnchor: mockSetMagnetAnchor,
    };
    mockExportFormat = 'stl';
    mockTiling = null;
  });

  // 4×6 drawer at 42mm → 168×252mm grid, tr/tl rounded 50mm.
  const CUTS: CornerCutParams = {
    tl: { kind: 'radius', r: 50 },
    tr: { kind: 'radius', r: 50 },
    bl: { kind: 'none' },
    br: { kind: 'none' },
  };
  const CORNER_OUTLINE = {
    vertices: cornerCutVertices(168, 252, CUTS),
    authoring: { kind: 'corners', corners: CUTS },
  };

  it('keeps padding controls, shows the corner-shape note, hides rounding', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: CORNER_OUTLINE } as never;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.padding')).toBeInTheDocument();
    expect(screen.getByText('baseplate.cornerShapedPaddingNotice')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.shapedDrawerNotice')).toBeNull();
    expect(screen.queryByText('baseplate.cornerRadius')).toBeNull();
  });

  it('hides detach margins even with detach-worthy padding', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: CORNER_OUTLINE } as never;
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 35,
      paddingRight: 35,
      paddingFront: 35,
      paddingBack: 35,
    };
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.detachMargins')).toBeNull();
  });

  it('treats a drifted authoring echo as a painted shape', () => {
    mockLayoutState.layout.drawer = {
      width: 4,
      depth: 6,
      outline: {
        // Vertices from different cuts than the echo claims.
        vertices: cornerCutVertices(168, 252, { ...CUTS, tl: { kind: 'radius', r: 20 } }),
        authoring: { kind: 'corners', corners: CUTS },
      },
    } as never;
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.shapedDrawerNotice')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.padding')).toBeNull();
  });

  it('mm entry keeps sync + shape and distributes the remainder as padding', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: CORNER_OUTLINE } as never;
    render(<BaseplatePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
    const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
    const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
    // 190×290 basket over the fixed 168×252 grid → 11mm / 19mm per side.
    fireEvent.change(widthInput, { target: { value: '190' } });
    fireEvent.change(depthInput, { target: { value: '290' } });
    fireEvent.keyDown(depthInput, { key: 'Enter' });

    expect(mockSetBaseplateParams).toHaveBeenCalledWith(
      expect.objectContaining({
        paddingLeft: 11,
        paddingRight: 11,
        paddingFront: 19,
        paddingBack: 19,
      })
    );
    const call = mockSetBaseplateParams.mock.calls.at(-1)?.[0] as {
      syncWithLayout?: boolean;
      baseplateWidth?: number;
    };
    expect(call.syncWithLayout).not.toBe(false);
    expect(call.baseplateWidth).toBeUndefined();
  });

  it('mm entry clamps below-grid targets to zero padding', () => {
    mockLayoutState.layout.drawer = { width: 4, depth: 6, outline: CORNER_OUTLINE } as never;
    render(<BaseplatePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.editDimensions' }));
    const widthInput = screen.getByLabelText('baseplate.editDimensionsWidth');
    const depthInput = screen.getByLabelText('baseplate.editDimensionsDepth');
    fireEvent.change(widthInput, { target: { value: '100' } });
    fireEvent.change(depthInput, { target: { value: '252' } });
    fireEvent.keyDown(depthInput, { key: 'Enter' });

    expect(mockSetBaseplateParams).toHaveBeenCalledWith(
      expect.objectContaining({
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
      })
    );
  });
});
