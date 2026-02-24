import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Mock page store
let mockTiling: unknown = null;
let mockSplitViewMode = 'assembled';
const mockSetSplitViewMode = vi.fn();

vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      tiling: mockTiling,
      splitViewMode: mockSplitViewMode,
      setSplitViewMode: mockSetSplitViewMode,
    };
    return selector(state);
  },
}));

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
    mockTiling = null;
    mockSplitViewMode = 'assembled';
  });

  it('renders grid section with dimensions', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionGrid')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridDimensions')).toBeInTheDocument();
  });

  it('renders padding section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionFitToDrawer')).toBeInTheDocument();
  });

  it('renders magnet section', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionMagnets')).toBeInTheDocument();
  });

  it('hides reset button when params are default', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByLabelText('baseplate.resetParams')).not.toBeInTheDocument();
  });

  it('shows reset button when params differ from defaults', () => {
    mockLayoutState.layout.baseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: 5,
    };
    render(<BaseplatePanel />);
    expect(screen.getByLabelText('baseplate.resetParams')).toBeInTheDocument();
  });

  it('does not render split section when tiling is null', () => {
    render(<BaseplatePanel />);
    expect(screen.queryByText('baseplate.sectionSplit')).not.toBeInTheDocument();
  });

  it('renders split section when tiling is split', () => {
    mockTiling = {
      isSplit: true,
      cols: 2,
      rows: 1,
      pieces: [
        { label: 'A1', col: 0, row: 0 },
        { label: 'B1', col: 1, row: 0 },
      ],
      totalWidthUnits: 9,
      totalDepthUnits: 6,
      stackCount: 1,
      stackSeparatorThickness: 0,
    };
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.sectionSplit')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('renders segmented control for split view mode', () => {
    mockTiling = {
      isSplit: true,
      cols: 2,
      rows: 1,
      pieces: [
        { label: 'A1', col: 0, row: 0 },
        { label: 'B1', col: 1, row: 0 },
      ],
      totalWidthUnits: 9,
      totalDepthUnits: 6,
      stackCount: 1,
      stackSeparatorThickness: 0,
    };
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.viewAssembled')).toBeInTheDocument();
    expect(screen.getByText('baseplate.viewExploded')).toBeInTheDocument();
  });

  it('renders magnet toggle as switch', () => {
    render(<BaseplatePanel />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders print bed size stepper', () => {
    render(<BaseplatePanel />);
    expect(screen.getByText('baseplate.printBedSize')).toBeInTheDocument();
  });
});
