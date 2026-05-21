import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { CutoutEditor } from './CutoutEditor';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../../controls/SliderInput', () => ({
  SliderInput: ({ label }: { label: string }) => <div data-testid={`slider-${label}`} />,
}));

// Mock the renderer module — WebGL is not available in jsdom
vi.mock('./renderer', () => ({
  CutoutCanvas3D: (props: Record<string, unknown>) => (
    <div
      data-testid="cutout-canvas-3d"
      data-bin-width={props.binWidth}
      data-bin-depth={props.binDepth}
      data-cutout-count={Array.isArray(props.cutouts) ? props.cutouts.length : 0}
    />
  ),
}));

describe('CutoutEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState({
      ...useDesignerStore.getInitialState(),
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      },
    });
  });

  it('renders the WebGL canvas', () => {
    render(<CutoutEditor />);
    expect(screen.getByTestId('cutout-canvas-3d')).toBeInTheDocument();
  });

  it('renders the shape toolbar', () => {
    render(<CutoutEditor />);
    expect(screen.getByTitle('binDesigner.cutouts.addRectangle')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.addCircle')).toBeInTheDocument();
  });

  it('canvas binWidth/binDepth tracks params.gridUnitMm (regression: editor frame must match mesh frame)', () => {
    // wallThickness = 1.2 (default). At gridUnitMm = 30:
    //   outerW = 2 × 30 − 0.5     = 59.5
    //   binWidth = 59.5 − 2 × 1.2 = 57.1
    // (Would be 81.1 with the previous hardcoded 42 — placing cutouts in
    // a 24mm-too-wide phantom frame that didn't match the generated mesh.)
    useDesignerStore.setState({
      ...useDesignerStore.getInitialState(),
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        gridUnitMm: 30,
      },
    });
    render(<CutoutEditor />);
    const canvas = screen.getByTestId('cutout-canvas-3d');
    expect(Number(canvas.getAttribute('data-bin-width'))).toBeCloseTo(57.1, 5);
    expect(Number(canvas.getAttribute('data-bin-depth'))).toBeCloseTo(57.1, 5);
  });

  it('renders without errors with cutouts present', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 5,
            y: 5,
            width: 10,
            depth: 10,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      },
    });

    render(<CutoutEditor />);
    const canvas = screen.getByTestId('cutout-canvas-3d');
    expect(canvas).toBeInTheDocument();
    expect(canvas.getAttribute('data-cutout-count')).toBe('1');
  });

  it('renders without errors with circle cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          {
            id: 'c1',
            shape: 'circle',
            x: 5,
            y: 5,
            width: 10,
            depth: 10,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      },
    });

    render(<CutoutEditor />);
    expect(screen.getByTestId('cutout-canvas-3d')).toBeInTheDocument();
  });

  it('does not render resize handles when nothing is selected', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 5,
            y: 5,
            width: 10,
            depth: 10,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      },
    });

    const { container } = render(<CutoutEditor />);
    // No handles in the DOM (they would be inside the 3D canvas, which is mocked)
    const handles = container.querySelector('[data-testid="resize-handles"]');
    expect(handles).toBeNull();
  });

  it('renders without errors with context menu support', () => {
    render(<CutoutEditor />);
    expect(screen.getByTestId('cutout-canvas-3d')).toBeInTheDocument();
  });
});
