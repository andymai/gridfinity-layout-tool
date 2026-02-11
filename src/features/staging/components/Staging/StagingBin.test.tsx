import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StagingBin } from './StagingBin';
import { binId, categoryId } from '@/core/types';
import type { PackedBin } from '@/features/staging/utils/packing';

/**
 * Helper to create a grid container wrapper for StagingBin.
 * The component uses CSS Grid positioning, so it must be wrapped correctly.
 */
function renderInGrid(ui: React.ReactElement) {
  return render(
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 40px)',
        gridTemplateRows: 'repeat(10, 40px)',
        gap: '4px',
      }}
    >
      {ui}
    </div>
  );
}

/**
 * Helper to get a bin element by its ID
 */
function getBinElement(container: HTMLElement, binIdValue: string): HTMLElement {
  const element = container.querySelector(`[data-staging-bin-id="${binIdValue}"]`);
  if (!element) throw new Error(`Bin with id ${binIdValue} not found`);
  return element as HTMLElement;
}

describe('StagingBin', () => {
  /** Helper to create default props with all required callbacks */
  function defaultProps(overrides?: Partial<Parameters<typeof StagingBin>[0]>) {
    const defaultBin: PackedBin = {
      id: binId('bin-1'),
      x: 0,
      y: 0,
      width: 3,
      depth: 2,
      height: 4,
      category: categoryId('cat-1'),
      label: 'Tools',
    };

    const bin: PackedBin = overrides?.bin ? { ...defaultBin, ...overrides.bin } : defaultBin;

    // Separate out bin from overrides to avoid duplicate key warning
    const { bin: _binOverride, ...otherOverrides } = overrides || {};

    return {
      bin,
      categoryColor: '#3b82f6',
      isSelected: false,
      isDragging: false,
      isHovered: false,
      isTouchDevice: false,
      cellSize: 40,
      gap: 4,
      gridHeight: 10,
      hasFractionalWidth: false,
      integerWidth: 10,
      fractionalWidthPart: 0,
      fractionalCellWidth: 0,
      onBinClick: vi.fn(),
      onBinPointerDown: vi.fn(),
      onBinPointerMove: vi.fn(),
      onBinPointerEnd: vi.fn(),
      onBinContextMenu: vi.fn(),
      onPointerEnter: vi.fn(),
      onPointerLeave: vi.fn(),
      onRotate: vi.fn(),
      ...otherOverrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bin with data attribute', () => {
    const props = defaultProps();
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toBeInTheDocument();
    expect(binElement).toHaveAttribute('data-staging-bin-id', 'bin-1');
  });

  it('shows dimensions text with Unicode multiplication symbol', () => {
    const props = defaultProps({ bin: { width: 3, depth: 2 } });
    renderInGrid(<StagingBin {...props} />);

    // Note: uses Unicode × character, not 'x'
    expect(screen.getByText('3×2')).toBeInTheDocument();
  });

  it('shows label when it fits in large bin', () => {
    const props = defaultProps({
      bin: {
        width: 4,
        depth: 4,
        label: 'Tools',
      },
    });
    renderInGrid(<StagingBin {...props} />);

    // Label should be visible (primary text)
    expect(screen.getByText('Tools')).toBeInTheDocument();
    // Dimensions should appear as secondary text (if space allows)
    expect(screen.getByText('4×4')).toBeInTheDocument();
  });

  it('shows dimensions instead of label when label is too long', () => {
    const props = defaultProps({
      bin: {
        width: 1,
        depth: 1,
        label: 'Very Long Label That Will Not Fit',
      },
    });
    renderInGrid(<StagingBin {...props} />);

    // Label won't fit, so dimensions should be shown
    expect(screen.getByText('1×1')).toBeInTheDocument();
    // Long label should not be visible
    expect(screen.queryByText('Very Long Label That Will Not Fit')).not.toBeInTheDocument();
  });

  it('formats fractional dimensions correctly', () => {
    const props = defaultProps({
      bin: {
        width: 1.5,
        depth: 2.5,
      },
    });
    renderInGrid(<StagingBin {...props} />);

    expect(screen.getByText('1.5×2.5')).toBeInTheDocument();
  });

  it('applies category color as background', () => {
    const props = defaultProps({ categoryColor: '#ff5733' });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toHaveStyle({ backgroundColor: '#ff5733' });
  });

  it('shows selection ring when selected', () => {
    const props = defaultProps({ isSelected: true });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toHaveClass('ring-2', 'ring-selection-ring');
  });

  it('shows dragging state with dashed border', () => {
    const props = defaultProps({ isDragging: true });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toHaveClass('border-dashed');
  });

  it('hides text when dragging', () => {
    const props = defaultProps({
      isDragging: true,
      bin: { width: 3, depth: 2 },
    });
    renderInGrid(<StagingBin {...props} />);

    // Text should not be visible during drag
    expect(screen.queryByText('3×2')).not.toBeInTheDocument();
  });

  it('shows rotate button on hover for desktop', () => {
    const props = defaultProps({
      isHovered: true,
      isTouchDevice: false,
    });
    renderInGrid(<StagingBin {...props} />);

    // Rotate button should be present (has title "Rotate bin (R)")
    const rotateButton = screen.getByTitle('Rotate bin (R)');
    expect(rotateButton).toBeInTheDocument();
  });

  it('hides rotate button on touch devices', () => {
    const props = defaultProps({
      isHovered: true,
      isTouchDevice: true,
    });
    renderInGrid(<StagingBin {...props} />);

    // Rotate button should not be present on touch devices
    expect(screen.queryByTitle('Rotate bin (R)')).not.toBeInTheDocument();
  });

  it('hides rotate button when not hovered and not selected', () => {
    const props = defaultProps({
      isHovered: false,
      isSelected: false,
      isTouchDevice: false,
    });
    renderInGrid(<StagingBin {...props} />);

    expect(screen.queryByTitle('Rotate bin (R)')).not.toBeInTheDocument();
  });

  it('shows rotate button when selected even if not hovered', () => {
    const props = defaultProps({
      isHovered: false,
      isSelected: true,
      isTouchDevice: false,
    });
    renderInGrid(<StagingBin {...props} />);

    expect(screen.getByTitle('Rotate bin (R)')).toBeInTheDocument();
  });

  it('fires onBinClick with bin ID', () => {
    const props = defaultProps();
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    fireEvent.click(binElement);

    expect(props.onBinClick).toHaveBeenCalledTimes(1);
    expect(props.onBinClick).toHaveBeenCalledWith('bin-1', expect.any(Object));
  });

  it('fires onBinContextMenu on right click', () => {
    const props = defaultProps();
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    fireEvent.contextMenu(binElement);

    expect(props.onBinContextMenu).toHaveBeenCalledTimes(1);
    expect(props.onBinContextMenu).toHaveBeenCalledWith('bin-1', expect.any(Object));
  });

  it('fires onRotate from rotate button pointerDown', () => {
    const props = defaultProps({ isHovered: true });
    renderInGrid(<StagingBin {...props} />);

    const rotateButton = screen.getByTitle('Rotate bin (R)');
    fireEvent.pointerDown(rotateButton);

    expect(props.onRotate).toHaveBeenCalledTimes(1);
    expect(props.onRotate).toHaveBeenCalledWith('bin-1');
  });

  it('fires onBinPointerDown with bin ID', () => {
    const props = defaultProps();
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    fireEvent.pointerDown(binElement);

    expect(props.onBinPointerDown).toHaveBeenCalledTimes(1);
    expect(props.onBinPointerDown).toHaveBeenCalledWith('bin-1', expect.any(Object));
  });

  it('fires onPointerEnter when pointer enters', () => {
    const props = defaultProps();
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    fireEvent.pointerEnter(binElement);

    expect(props.onPointerEnter).toHaveBeenCalledTimes(1);
  });

  it('fires onPointerLeave when pointer leaves', () => {
    const props = defaultProps();
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    fireEvent.pointerLeave(binElement);

    expect(props.onPointerLeave).toHaveBeenCalledTimes(1);
  });

  it('renders tooltip with bin details', () => {
    const props = defaultProps({
      bin: {
        width: 3,
        depth: 2,
        height: 4,
        label: 'Hardware',
      },
    });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toHaveAttribute('title', '3×2×4u - Hardware');
  });

  it('shows "Unlabeled" in tooltip when label is empty', () => {
    const props = defaultProps({
      bin: {
        width: 2,
        depth: 2,
        height: 3,
        label: '',
      },
    });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toHaveAttribute('title', '2×2×3u - Unlabeled');
  });

  it('applies transparent background when dragging', () => {
    const props = defaultProps({
      isDragging: true,
      categoryColor: '#3b82f6',
    });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    // When dragging, backgroundColor is not applied (transparent)
    expect(binElement).not.toHaveStyle({ backgroundColor: '#3b82f6' });
  });

  it('renders without text when bin is too small', () => {
    const props = defaultProps({
      bin: { width: 0.5, depth: 0.5 },
      cellSize: 20, // Small cell size means bin pixel width < 24
    });
    renderInGrid(<StagingBin {...props} />);

    // Text should not render for very small bins
    expect(screen.queryByText('0.5×0.5')).not.toBeInTheDocument();
  });

  it('handles fractional drawer width correctly', () => {
    // Bins always have integer positions (from packBins), but the drawer
    // may have fractional width requiring pixel-level width overrides
    const props = defaultProps({
      bin: {
        x: 0,
        y: 0,
        width: 2,
        depth: 1,
      },
      hasFractionalWidth: true,
      integerWidth: 8,
      fractionalWidthPart: 0.5,
      fractionalCellWidth: 20,
    });
    const { container } = renderInGrid(<StagingBin {...props} />);

    const binElement = getBinElement(container, 'bin-1');
    expect(binElement).toBeInTheDocument();
    // Width override should be applied when hasFractionalWidth is true
    const styleAttr = binElement.getAttribute('style') ?? '';
    expect(styleAttr).toContain('width');
  });
});
