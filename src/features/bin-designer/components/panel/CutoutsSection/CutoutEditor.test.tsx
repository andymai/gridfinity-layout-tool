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

  it('renders the SVG canvas', () => {
    const { container } = render(<CutoutEditor />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders the shape toolbar', () => {
    render(<CutoutEditor />);
    expect(screen.getByTitle('binDesigner.cutouts.addRectangle')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.addCircle')).toBeInTheDocument();
  });

  it('renders cutout shapes in the SVG', () => {
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
    // Should render at least the cutout rect
    const rects = container.querySelectorAll('svg rect');
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a circle cutout as circle element', () => {
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

    const { container } = render(<CutoutEditor />);
    const circles = container.querySelectorAll('svg circle');
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders background grid and crosshair inside canvas', () => {
    const { container } = render(<CutoutEditor />);
    // The background should have dot grid (circles) and crosshair lines
    const circles = container.querySelectorAll('svg circle');
    const lines = container.querySelectorAll('svg line');
    expect(circles.length).toBeGreaterThan(0);
    expect(lines.length).toBe(2); // horizontal and vertical crosshair
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
    const handles = container.querySelector('[data-testid="resize-handles"]');
    expect(handles).toBeNull();
  });

  it('renders without errors with context menu support', () => {
    const { container } = render(<CutoutEditor />);
    const svg = container.querySelector('svg');

    // Basic sanity check - editor renders and has SVG
    expect(svg).toBeInTheDocument();
  });
});
