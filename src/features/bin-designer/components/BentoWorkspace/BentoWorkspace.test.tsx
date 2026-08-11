import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoWorkspace } from './BentoWorkspace';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mocks = vi.hoisted(() => ({
  setBentoWorkspaceOpen: vi.fn(),
  markQuickstartSeen: vi.fn(),
  quickstartSeen: true,
  grid: {
    cols: 3,
    rows: 2,
    compartmentCount: 6,
    hasMergedCompartments: false,
    aspectRatio: 2,
    interiorW: 100,
    interiorD: 50,
    isDragging: false,
    selectionAction: 'none' as const,
    hoveredIsSplittable: false,
    instructionText: 'drag or click',
    applyGrid: vi.fn(),
    stepGrid: vi.fn(),
    handleReset: vi.fn(),
  },
  box: {
    width: 300,
    height: 150,
    scaleX: 3,
    scaleY: 3,
  },
}));

vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ setBentoWorkspaceOpen: mocks.setBentoWorkspaceOpen })
  ),
}));

vi.mock('../CompartmentEditor/useCompartmentGrid', () => ({
  useCompartmentGrid: () => mocks.grid,
}));

vi.mock('../CompartmentEditor/CompartmentGridView', () => ({
  CompartmentGridView: ({ style }: { style?: Record<string, string> }) => (
    <div data-testid="grid-view" data-width={style?.width} data-height={style?.height} />
  ),
}));

vi.mock('./useBentoCanvasBox', () => ({
  useBentoCanvasBox: () => mocks.box,
}));

vi.mock('../CompartmentEditor/useDividerTiltSubsection', () => ({
  useDividerTiltSubsection: () => ({
    rows: [{ key: '0-1', axis: 'vertical', angleDeg: 0, shiftMm: 0, geometry: {} }],
    handlers: { previewTilt: vi.fn(), commitTilt: vi.fn() },
  }),
}));

vi.mock('../../hooks/useBentoQuickstart', () => ({
  useBentoQuickstart: () => ({
    quickstartSeen: mocks.quickstartSeen,
    markQuickstartSeen: mocks.markQuickstartSeen,
  }),
}));

vi.mock('./BentoLabelBar', () => ({
  BentoLabelBar: () => <div data-testid="label-bar" />,
}));

vi.mock('./BentoQuickstartOverlay', () => ({
  BentoQuickstartOverlay: () => <div data-testid="quickstart" />,
}));

vi.mock('./useDividerDrag', () => ({
  useDividerDrag: () => ({ draggingKey: null, onDragStart: vi.fn() }),
}));

vi.mock('../CutoutWorkspace/Rulers', () => ({
  TopRuler: ({ length }: { length: number }) => (
    <div data-testid="top-ruler" data-length={length} />
  ),
  LeftRuler: ({ length }: { length: number }) => (
    <div data-testid="left-ruler" data-length={length} />
  ),
  RulerCorner: () => <div data-testid="ruler-corner" />,
}));

describe('BentoWorkspace', () => {
  beforeEach(() => {
    mocks.setBentoWorkspaceOpen.mockClear();
    mocks.quickstartSeen = true;
    mocks.box.width = 300;
    mocks.box.height = 150;
  });

  it('draws the grid alongside both rulers', () => {
    render(<BentoWorkspace />);

    expect(screen.getByTestId('grid-view')).toBeInTheDocument();
    expect(screen.getByTestId('top-ruler')).toBeInTheDocument();
    expect(screen.getByTestId('left-ruler')).toBeInTheDocument();
  });

  it('sizes the rulers to the same box as the grid', () => {
    render(<BentoWorkspace />);

    // A ruler measured against a different box would label the wrong wall.
    expect(screen.getByTestId('top-ruler')).toHaveAttribute('data-length', '300');
    expect(screen.getByTestId('left-ruler')).toHaveAttribute('data-length', '150');
    expect(screen.getByTestId('grid-view')).toHaveAttribute('data-width', '300px');
    expect(screen.getByTestId('grid-view')).toHaveAttribute('data-height', '150px');
  });

  it('draws nothing until the container has been measured', () => {
    mocks.box.width = 0;
    mocks.box.height = 0;
    render(<BentoWorkspace />);

    expect(screen.queryByTestId('grid-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('top-ruler')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<BentoWorkspace />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mocks.setBentoWorkspaceOpen).toHaveBeenCalledWith(false);
  });

  it('closes from the header Done button', () => {
    render(<BentoWorkspace />);

    fireEvent.click(screen.getByText('common.done'));

    expect(mocks.setBentoWorkspaceOpen).toHaveBeenCalledWith(false);
  });

  it('stops listening for Escape once unmounted', () => {
    const { unmount } = render(<BentoWorkspace />);
    unmount();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mocks.setBentoWorkspaceOpen).not.toHaveBeenCalled();
  });

  it('shows the quickstart card only until it is dismissed', () => {
    const { unmount } = render(<BentoWorkspace />);
    expect(screen.queryByTestId('quickstart')).not.toBeInTheDocument();
    unmount();

    mocks.quickstartSeen = false;
    render(<BentoWorkspace />);
    expect(screen.getByTestId('quickstart')).toBeInTheDocument();
  });

  it('lets the quickstart card have the first Escape', () => {
    mocks.quickstartSeen = false;
    render(<BentoWorkspace />);

    fireEvent.keyDown(window, { key: 'Escape' });

    // Otherwise the card and the workspace both close on one keypress and the
    // card is never actually read.
    expect(mocks.setBentoWorkspaceOpen).not.toHaveBeenCalled();
  });

  it('shows the shared instruction text', () => {
    render(<BentoWorkspace />);

    expect(screen.getByText('drag or click')).toBeInTheDocument();
  });
});
