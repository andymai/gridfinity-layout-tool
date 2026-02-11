import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FloatingInspector } from './FloatingInspector';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/components/CompactNumberInput', () => ({
  CompactNumberInput: ({
    label,
    value,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }) => <input data-testid={`compact-input-${label}`} data-label={label} value={value} readOnly />,
}));

vi.mock('@/features/bin-designer/components/controls/SliderInput', () => ({
  SliderInput: ({
    label,
    value,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }) => <input data-testid={`slider-input-${label}`} data-label={label} value={value} readOnly />,
}));

vi.mock('../panel/CutoutsSection/geometry', () => ({
  clampRotationToBounds: (_c: Cutout, rotation: number) => rotation,
  getRotatedBounds: (c: Cutout) => ({
    minX: c.x,
    minY: c.y,
    maxX: c.x + c.width,
    maxY: c.y + c.depth,
  }),
}));

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'cutout1',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 2,
  label: '',
  groupId: null,
  locked: false,
  hidden: false,
  ...overrides,
});

describe('FloatingInspector', () => {
  const defaultProps = {
    cutouts: [],
    selection: new Set<string>(),
    preview: new Map<string, Partial<Cutout>>(),
    binWidth: 100,
    binDepth: 100,
    maxCutDepth: 10,
    onUpdate: vi.fn(),
    zoom: 1,
    cameraCenter: { x: 0, y: 0 },
    canvasWidth: 800,
    canvasHeight: 600,
    hidden: false,
    disabled: false,
  };

  it('returns null when selection is empty', () => {
    const { container } = render(<FloatingInspector {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when hidden prop is true', () => {
    const cutout = createCutout();
    const { container } = render(
      <FloatingInspector
        {...defaultProps}
        cutouts={[cutout]}
        selection={new Set(['cutout1'])}
        hidden={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders compact inputs for X/Y/W/H and sliders for R/Depth', () => {
    const cutout = createCutout({ shape: 'rectangle', cornerRadius: 3 });
    render(
      <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
    );

    // Compact inputs for position/size
    expect(screen.getByTestId('compact-input-X')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-Y')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-W')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-H')).toBeInTheDocument();

    // Sliders for rotation, depth, and scoop
    expect(screen.getByTestId('slider-input-Rotation')).toBeInTheDocument();
    expect(screen.getByTestId('slider-input-Depth')).toBeInTheDocument();
    expect(screen.getByTestId('slider-input-Scoop')).toBeInTheDocument();
  });

  it('shows corner radius slider only for rectangles', () => {
    const cutout = createCutout({ shape: 'rectangle' });
    const { rerender } = render(
      <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
    );

    expect(screen.getByTestId('slider-input-binDesigner.cutouts.cornerRadius')).toBeInTheDocument();

    // Change to circle
    const circleCutout = createCutout({ shape: 'circle' });
    rerender(
      <FloatingInspector
        {...defaultProps}
        cutouts={[circleCutout]}
        selection={new Set(['cutout1'])}
      />
    );

    expect(
      screen.queryByTestId('slider-input-binDesigner.cutouts.cornerRadius')
    ).not.toBeInTheDocument();
  });

  it('renders multi-select view with shared rotation and depth sliders', () => {
    const cutout1 = createCutout({ id: 'c1', rotation: 45, cutDepth: 6 });
    const cutout2 = createCutout({ id: 'c2', rotation: 45, cutDepth: 6 });

    render(
      <FloatingInspector
        {...defaultProps}
        cutouts={[cutout1, cutout2]}
        selection={new Set(['c1', 'c2'])}
      />
    );

    // Should show multi-select info
    expect(screen.getByText(/2\s+bindesigner\.cutouteditor\.actions/i)).toBeInTheDocument();

    // Should only show rotation, depth, and scoop sliders for multi-select
    expect(screen.getByTestId('slider-input-Rotation')).toBeInTheDocument();
    expect(screen.getByTestId('slider-input-Depth')).toBeInTheDocument();
    expect(screen.getByTestId('slider-input-Scoop')).toBeInTheDocument();

    // Should NOT show compact inputs
    expect(screen.queryByTestId('compact-input-X')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compact-input-Y')).not.toBeInTheDocument();
  });

  it('shows locked badge when cutout is locked', () => {
    const cutout = createCutout({ locked: true });
    render(
      <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
    );

    expect(screen.getByText('binDesigner.cutoutEditor.locked')).toBeInTheDocument();
  });

  it('does not show hidden badge', () => {
    const cutout = createCutout({ hidden: true });
    render(
      <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
    );

    expect(screen.queryByText('binDesigner.cutoutEditor.hidden')).not.toBeInTheDocument();
  });

  it('does not show status badges for multi-selection', () => {
    const cutout1 = createCutout({ id: 'c1', locked: true });
    const cutout2 = createCutout({ id: 'c2', hidden: true });

    render(
      <FloatingInspector
        {...defaultProps}
        cutouts={[cutout1, cutout2]}
        selection={new Set(['c1', 'c2'])}
      />
    );

    // Status badges only show for single selection
    expect(screen.queryByText('binDesigner.cutoutEditor.locked')).not.toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutoutEditor.hidden')).not.toBeInTheDocument();
  });

  it('respects preview overrides for displayed values', () => {
    const cutout = createCutout({ x: 10, y: 20, width: 30 });
    const preview = new Map<string, Partial<Cutout>>([['cutout1', { x: 15, y: 25 }]]);

    render(
      <FloatingInspector
        {...defaultProps}
        cutouts={[cutout]}
        selection={new Set(['cutout1'])}
        preview={preview}
      />
    );

    const xInput = screen.getByTestId('compact-input-X');
    const yInput = screen.getByTestId('compact-input-Y');

    // Should show preview values, not original
    expect(xInput).toHaveValue('15');
    expect(yInput).toHaveValue('25');
  });

  describe('position locking during interaction', () => {
    it('locks panel position on pointerdown and unlocks on pointerup', () => {
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 20 });
      const { container, rerender } = render(
        <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
      );

      const panel = container.firstChild as HTMLElement;
      const initialLeft = panel.style.left;
      const initialTop = panel.style.top;

      // Simulate pointer down on panel (user starts dragging a slider)
      fireEvent.pointerDown(panel);

      // Re-render with a cutout that has different bounds (simulating rotation change)
      const changedCutout = createCutout({ x: 10, y: 5, width: 30, depth: 40 });
      rerender(
        <FloatingInspector
          {...defaultProps}
          cutouts={[changedCutout]}
          selection={new Set(['cutout1'])}
        />
      );

      // Position should be locked to original values
      expect(panel.style.left).toBe(initialLeft);
      expect(panel.style.top).toBe(initialTop);

      // Simulate pointer up (user releases slider)
      act(() => {
        fireEvent.pointerUp(window);
      });

      // Position should now reflect the new bounds
      expect(panel.style.left).not.toBe(initialLeft);
    });

    it('keeps position locked when focus moves between controls within the panel', () => {
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 20 });
      const { container, rerender } = render(
        <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
      );

      const panel = container.firstChild as HTMLElement;
      const initialLeft = panel.style.left;
      const rotationSlider = screen.getByTestId('slider-input-Rotation');
      const depthSlider = screen.getByTestId('slider-input-Depth');

      // Focus an input (locks position)
      fireEvent.focusIn(rotationSlider, { relatedTarget: null });

      // Change bounds
      const changedCutout = createCutout({ x: 10, y: 5, width: 30, depth: 40 });
      rerender(
        <FloatingInspector
          {...defaultProps}
          cutouts={[changedCutout]}
          selection={new Set(['cutout1'])}
        />
      );

      // Position stays locked
      expect(panel.style.left).toBe(initialLeft);

      // Move focus within panel (blur one, focus another)
      // relatedTarget is inside the panel, so it should NOT unlock
      fireEvent.focusOut(rotationSlider, { relatedTarget: depthSlider });
      fireEvent.focusIn(depthSlider, { relatedTarget: rotationSlider });

      // Still locked
      expect(panel.style.left).toBe(initialLeft);
    });

    it('unlocks position when focus leaves the panel entirely', () => {
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 20 });
      const { container, rerender } = render(
        <FloatingInspector {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
      );

      const panel = container.firstChild as HTMLElement;
      const initialLeft = panel.style.left;
      const rotationSlider = screen.getByTestId('slider-input-Rotation');

      // Focus an input (locks position)
      fireEvent.focusIn(rotationSlider, { relatedTarget: null });

      // Change bounds
      const changedCutout = createCutout({ x: 10, y: 5, width: 30, depth: 40 });
      rerender(
        <FloatingInspector
          {...defaultProps}
          cutouts={[changedCutout]}
          selection={new Set(['cutout1'])}
        />
      );

      expect(panel.style.left).toBe(initialLeft);

      // Focus leaves panel entirely (relatedTarget is outside)
      act(() => {
        fireEvent.focusOut(rotationSlider, { relatedTarget: document.body });
      });

      // Position should update
      expect(panel.style.left).not.toBe(initialLeft);
    });
  });
});
