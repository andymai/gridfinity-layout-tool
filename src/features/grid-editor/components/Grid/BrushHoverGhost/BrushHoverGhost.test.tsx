import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { BrushHoverGhost } from './BrushHoverGhost';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store/interaction';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { createDefaultLayout } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';

const mockGetGridCoords = vi.fn().mockReturnValue({ x: 3, y: 2 });

vi.mock('@/features/grid-editor/hooks/useGridCoords', () => ({
  useGridCoords: () => ({ getGridCoords: mockGetGridCoords }),
}));

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} data-testid="grid">
      <BrushHoverGhost gridRef={ref} cellSize={32} gap={2} />
    </div>
  );
}

describe('BrushHoverGhost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGridCoords.mockReturnValue({ x: 3, y: 2 });
    resetAllStores();
    useLayoutStore.setState({ layout: createDefaultLayout() });
    useInteractionStore.setState({ paintSize: null, interaction: null });
    useHalfGridModeStore.setState({ halfGridMode: false });
  });

  it('renders nothing when no brush size is loaded', () => {
    const { queryByTestId, getByTestId } = render(<Harness />);
    fireEvent.pointerMove(getByTestId('grid'), { isPrimary: true, clientX: 50, clientY: 50 });
    expect(queryByTestId('grid').querySelector('[data-brush-ghost]')).toBeNull();
  });

  it('shows the footprint ghost while hovering with a size loaded', () => {
    useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });
    const { getByTestId } = render(<Harness />);

    fireEvent.pointerMove(getByTestId('grid'), { isPrimary: true, clientX: 50, clientY: 50 });

    const ghost = getByTestId('grid').querySelector('[data-brush-ghost]');
    expect(ghost).not.toBeNull();
  });

  it('hides the ghost once the pointer leaves the grid', () => {
    useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });
    const { getByTestId } = render(<Harness />);
    const grid = getByTestId('grid');

    fireEvent.pointerMove(grid, { isPrimary: true, clientX: 50, clientY: 50 });
    expect(grid.querySelector('[data-brush-ghost]')).not.toBeNull();

    fireEvent.pointerLeave(grid);
    expect(grid.querySelector('[data-brush-ghost]')).toBeNull();
  });

  it('does not show the ghost in half-grid mode', () => {
    useInteractionStore.setState({ paintSize: { width: 2, depth: 2 } });
    useHalfGridModeStore.setState({ halfGridMode: true });
    const { getByTestId } = render(<Harness />);

    fireEvent.pointerMove(getByTestId('grid'), { isPrimary: true, clientX: 50, clientY: 50 });

    expect(getByTestId('grid').querySelector('[data-brush-ghost]')).toBeNull();
  });

  it('does not show the ghost while an interaction is in progress', () => {
    useInteractionStore.setState({
      paintSize: { width: 2, depth: 2 },
      interaction: {
        type: 'paint',
        start: { x: 0, y: 0 },
        current: { x: 0, y: 0 },
        paintSize: { width: 2, depth: 2 },
      },
    });
    const { getByTestId } = render(<Harness />);

    fireEvent.pointerMove(getByTestId('grid'), { isPrimary: true, clientX: 50, clientY: 50 });

    expect(getByTestId('grid').querySelector('[data-brush-ghost]')).toBeNull();
  });
});
