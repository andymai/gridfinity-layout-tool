import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { AlignmentToolbar } from './AlignmentToolbar';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, unknown>) => {
    if (vars && 'count' in vars) return `${vars.count} selected`;
    return key;
  },
}));

const createCutout = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('AlignmentToolbar', () => {
  const onUpdate = vi.fn();
  const onUpdateBatch = vi.fn();
  const onGroup = vi.fn();
  const onUngroup = vi.fn();
  const onSetGroupOp = vi.fn();
  const onReorder = vi.fn();
  const onDuplicate = vi.fn();

  const cutoutA = createCutout('a', { x: 5, y: 5 });
  const cutoutB = createCutout('b', { x: 30, y: 20 });
  const cutouts = [cutoutA, cutoutB];

  const defaultProps = {
    selectedIds: ['a', 'b'],
    cutouts,
    binWidth: 100,
    binDepth: 100,
    onUpdate,
    onUpdateBatch,
    onGroup,
    onUngroup,
    onSetGroupOp,
    onReorder,
    onDuplicate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows selection count', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('renders alignment buttons', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByLabelText('binDesigner.cutouts.alignLeft')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.alignRight')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.alignTop')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.alignBottom')).toBeInTheDocument();
  });

  it('calls onUpdate for each cutout when aligning left', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.alignLeft'));

    // Both cutouts should align to minX = 5 (cutoutA's x)
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ x: 5 }));
    expect(onUpdate).toHaveBeenCalledWith('b', expect.objectContaining({ x: 5 }));
  });

  it('calls onDuplicate with selectedIds', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('common.duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith(['a', 'b']);
  });

  it('renders the Pathfinder section with all four op buttons', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByLabelText('binDesigner.cutouts.pathfinder.union')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.pathfinder.subtract')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.pathfinder.intersect')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutouts.pathfinder.exclude')).toBeInTheDocument();
  });

  it('groups via Pathfinder Unite button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.pathfinder.union'));
    expect(onGroup).toHaveBeenCalledWith(['a', 'b'], 'union');
  });

  it('shows ungroup button when any cutout has a groupId', () => {
    const groupedCutouts = [
      createCutout('a', { groupId: 'g1' }),
      createCutout('b', { groupId: 'g1' }),
    ];
    render(<AlignmentToolbar {...defaultProps} cutouts={groupedCutouts} />);
    expect(screen.getByText('binDesigner.cutouts.ungroup')).toBeInTheDocument();
  });

  it('calls onUngroup when ungroup is clicked', () => {
    const groupedCutouts = [
      createCutout('a', { groupId: 'g1' }),
      createCutout('b', { groupId: 'g1' }),
    ];
    render(<AlignmentToolbar {...defaultProps} cutouts={groupedCutouts} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.ungroup'));
    expect(onUngroup).toHaveBeenCalledWith(['a', 'b']);
  });

  it('renders auto-arrange button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutouts.autoArrange')).toBeInTheDocument();
  });

  it('renders gap input with default value', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    // Multiple spinbuttons exist now (gap + rotation field). Disambiguate by min attribute.
    const spinbuttons = screen.getAllByRole('spinbutton');
    const gapInput = spinbuttons.find((el) => el.getAttribute('min') === '0');
    expect(gapInput).toBeDefined();
    expect(gapInput).toHaveValue(2);
  });

  it('renders distribute H button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutouts.distributeH')).toBeInTheDocument();
  });

  it('renders distribute V button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutouts.distributeV')).toBeInTheDocument();
  });

  it('disables distribute buttons when less than 3 cutouts selected', () => {
    const singleCutout = [createCutout('a')];
    render(<AlignmentToolbar {...defaultProps} cutouts={singleCutout} selectedIds={['a']} />);
    const distributeHBtn = screen.getByText('binDesigner.cutouts.distributeH').closest('button');
    const distributeVBtn = screen.getByText('binDesigner.cutouts.distributeV').closest('button');
    expect(distributeHBtn).toBeDisabled();
    expect(distributeVBtn).toBeDisabled();
  });

  it('enables distribute buttons when 3+ cutouts selected', () => {
    const threeCutouts = [
      createCutout('a', { x: 10 }),
      createCutout('b', { x: 30 }),
      createCutout('c', { x: 50 }),
    ];
    render(
      <AlignmentToolbar {...defaultProps} cutouts={threeCutouts} selectedIds={['a', 'b', 'c']} />
    );
    const distributeHBtn = screen.getByText('binDesigner.cutouts.distributeH').closest('button');
    const distributeVBtn = screen.getByText('binDesigner.cutouts.distributeV').closest('button');
    expect(distributeHBtn).not.toBeDisabled();
    expect(distributeVBtn).not.toBeDisabled();
  });

  it('calls onUpdate for each cutout when distributing horizontally', () => {
    const threeCutouts = [
      createCutout('a', { x: 10, width: 10 }),
      createCutout('b', { x: 50, width: 10 }),
      createCutout('c', { x: 30, width: 10 }),
    ];
    render(
      <AlignmentToolbar {...defaultProps} cutouts={threeCutouts} selectedIds={['a', 'b', 'c']} />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.distributeH'));

    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ x: expect.any(Number) }));
    expect(onUpdate).toHaveBeenCalledWith('b', expect.objectContaining({ x: expect.any(Number) }));
    expect(onUpdate).toHaveBeenCalledWith('c', expect.objectContaining({ x: expect.any(Number) }));
  });

  it('calls onUpdate for each cutout when distributing vertically', () => {
    const threeCutouts = [
      createCutout('a', { y: 10, depth: 10 }),
      createCutout('b', { y: 60, depth: 10 }),
      createCutout('c', { y: 35, depth: 10 }),
    ];
    render(
      <AlignmentToolbar {...defaultProps} cutouts={threeCutouts} selectedIds={['a', 'b', 'c']} />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.distributeV'));

    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ y: expect.any(Number) }));
    expect(onUpdate).toHaveBeenCalledWith('b', expect.objectContaining({ y: expect.any(Number) }));
    expect(onUpdate).toHaveBeenCalledWith('c', expect.objectContaining({ y: expect.any(Number) }));
  });

  it('renders center-in-bin button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutouts.centerInBin')).toBeInTheDocument();
  });

  it('calls onUpdate for each cutout when centering in bin', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.centerInBin'));

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
    expect(onUpdate).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });
});
