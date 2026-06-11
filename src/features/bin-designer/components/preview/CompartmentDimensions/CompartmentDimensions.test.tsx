import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';
import { CompartmentDimensions } from './CompartmentDimensions';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Line: () => <div data-testid="line" />,
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

vi.mock('@/shared/hooks/useThemeEffect', () => ({
  useThreeColors: () => ({ lineColor: '#888888' }),
}));

function setStore(hoveredCompartmentId: number | null, cols: number, rows: number): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      compartments: createUniformGrid(cols, rows, 1.2),
    },
    ui: { ...DEFAULT_UI_STATE, hoveredCompartmentId },
  });
}

describe('CompartmentDimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders nothing when no compartment is hovered', () => {
    setStore(null, 2, 2);
    const { container } = render(<CompartmentDimensions />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a single-compartment (1×1) grid', () => {
    setStore(0, 1, 1);
    const { container } = render(<CompartmentDimensions />);
    expect(container.firstChild).toBeNull();
  });

  it('draws width, depth, and height lines for the hovered compartment', () => {
    setStore(0, 2, 2);
    render(<CompartmentDimensions />);
    // 3 main lines + 6 end caps
    expect(screen.getAllByTestId('line').length).toBe(9);
    // width, depth, height labels
    expect(screen.getAllByTestId('r3f-text').length).toBe(3);
  });

  it('renders nothing when the hovered id is absent from the grid', () => {
    setStore(99, 2, 2);
    const { container } = render(<CompartmentDimensions />);
    expect(container.firstChild).toBeNull();
  });
});
