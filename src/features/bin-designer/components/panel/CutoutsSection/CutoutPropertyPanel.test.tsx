import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  SliderInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    unit: string;
  }) => (
    <div data-testid={`slider-${label}`}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  ),
}));

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'test-cutout',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('CutoutPropertyPanel', () => {
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  const onDuplicate = vi.fn();

  const defaultProps = {
    cutout: createCutout(),
    maxWidth: 100,
    maxDepth: 80,
    maxCutDepth: 30,
    onUpdate,
    onRemove,
    onDuplicate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders position, width, depth, cutDepth sliders for rectangle', () => {
    render(<CutoutPropertyPanel {...defaultProps} />);

    expect(screen.getByTestId('slider-binDesigner.cutouts.positionX')).toBeInTheDocument();
    expect(screen.getByTestId('slider-binDesigner.cutouts.positionY')).toBeInTheDocument();
    expect(screen.getByTestId('slider-binDesigner.cutouts.width')).toBeInTheDocument();
    expect(screen.getByTestId('slider-binDesigner.cutouts.depth')).toBeInTheDocument();
    expect(screen.getByTestId('slider-binDesigner.cutouts.cutDepth')).toBeInTheDocument();
    expect(screen.getByTestId('slider-binDesigner.cutouts.cornerRadius')).toBeInTheDocument();
  });

  it('shows width and depth but hides cornerRadius for circle', () => {
    render(<CutoutPropertyPanel {...defaultProps} cutout={createCutout({ shape: 'circle' })} />);

    expect(screen.getByTestId('slider-binDesigner.cutouts.width')).toBeInTheDocument();
    expect(screen.getByTestId('slider-binDesigner.cutouts.depth')).toBeInTheDocument();
    expect(screen.queryByTestId('slider-binDesigner.cutouts.cornerRadius')).not.toBeInTheDocument();
  });

  // Same rule as the workspace inspector: the sidebar's width/depth sliders are
  // the same measurement, so they hold the center too.
  it('holds the cutout center when width changes', () => {
    render(<CutoutPropertyPanel {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.width'), {
      target: { value: '40' },
    });
    // 20-wide at x=10 is centered on 20; a 40-wide box keeps that center.
    expect(onUpdate).toHaveBeenCalledWith('test-cutout', {
      width: 40,
      depth: 15,
      x: 0,
      y: 10,
    });
  });

  it('holds the cutout center when depth changes', () => {
    render(<CutoutPropertyPanel {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.depth'), {
      target: { value: '25' },
    });
    expect(onUpdate).toHaveBeenCalledWith('test-cutout', {
      width: 20,
      depth: 25,
      x: 10,
      y: 5,
    });
  });

  it('renders duplicate and delete buttons', () => {
    render(<CutoutPropertyPanel {...defaultProps} />);

    expect(screen.getByText('common.duplicate')).toBeInTheDocument();
    expect(screen.getByText('common.delete')).toBeInTheDocument();
  });

  it('calls onDuplicate with cutout id', () => {
    render(<CutoutPropertyPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('common.duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith(['test-cutout']);
  });

  it('calls onRemove with cutout id', () => {
    render(<CutoutPropertyPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('common.delete'));
    expect(onRemove).toHaveBeenCalledWith('test-cutout');
  });
});
