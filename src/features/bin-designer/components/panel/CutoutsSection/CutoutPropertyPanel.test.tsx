import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../../controls/SliderInput', () => ({
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
