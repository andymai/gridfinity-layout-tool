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

  it('batches one update per cutout when aligning left', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.alignLeft'));

    // Both cutouts align to minX = 5 (cutoutA's x). 'a' is already there, so
    // only 'b' is written.
    expect(onUpdateBatch).toHaveBeenCalledTimes(1);
    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    expect(updates.has('a')).toBe(false);
    expect(updates.get('b')).toEqual(expect.objectContaining({ x: 5 }));
  });

  it('keeps a group rigid when auto-arranging (#3468)', () => {
    // Two shapes 30mm apart, grouped, plus a loose shape. Auto-arrange must
    // reposition the group as one body rather than shelving its members apart.
    const grouped = [
      createCutout('g1a', { groupId: 'g1', x: 60, y: 60 }),
      createCutout('g1b', { groupId: 'g1', x: 90, y: 60 }),
      createCutout('solo', { x: 5, y: 5 }),
    ];
    render(
      <AlignmentToolbar {...defaultProps} cutouts={grouped} selectedIds={['g1a', 'g1b', 'solo']} />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.autoArrange'));

    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    const a = updates.get('g1a');
    const b = updates.get('g1b');
    expect((b?.x ?? 0) - (a?.x ?? 0)).toBe(30);
    expect(b?.y).toBe(a?.y);
  });

  it('pulls in the unselected members of a partially selected group', () => {
    const grouped = [
      createCutout('g1a', { groupId: 'g1', x: 60, y: 60 }),
      createCutout('g1b', { groupId: 'g1', x: 90, y: 60 }),
      createCutout('solo', { x: 5, y: 5 }),
    ];
    render(<AlignmentToolbar {...defaultProps} cutouts={grouped} selectedIds={['g1a', 'solo']} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.centerInBin'));

    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    expect(updates.has('g1b')).toBe(true);
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

  it('groups via Pathfinder Union button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.pathfinder.union'));
    expect(onGroup).toHaveBeenCalledWith(['a', 'b'], 'union');
  });

  it('offers a plain Group button for a loose multi-selection', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.group'));
    // No op argument — a plain group takes the default op.
    expect(onGroup).toHaveBeenCalledWith(['a', 'b']);
  });

  it('hides Group once the selection is already one whole group', () => {
    const groupedCutouts = [
      createCutout('a', { groupId: 'g1' }),
      createCutout('b', { groupId: 'g1' }),
    ];
    render(<AlignmentToolbar {...defaultProps} cutouts={groupedCutouts} />);
    expect(screen.queryByText('binDesigner.cutouts.group')).not.toBeInTheDocument();
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

  it('batches one update per cutout when distributing horizontally', () => {
    const threeCutouts = [
      createCutout('a', { x: 10, width: 10 }),
      createCutout('b', { x: 50, width: 10 }),
      createCutout('c', { x: 30, width: 10 }),
    ];
    render(
      <AlignmentToolbar {...defaultProps} cutouts={threeCutouts} selectedIds={['a', 'b', 'c']} />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.distributeH'));

    expect(onUpdateBatch).toHaveBeenCalledTimes(1);
    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    for (const id of ['a', 'b', 'c']) {
      expect(updates.get(id)).toEqual(expect.objectContaining({ x: expect.any(Number) }));
    }
  });

  it('batches one update per cutout when distributing vertically', () => {
    const threeCutouts = [
      createCutout('a', { y: 10, depth: 10 }),
      createCutout('b', { y: 60, depth: 10 }),
      createCutout('c', { y: 35, depth: 10 }),
    ];
    render(
      <AlignmentToolbar {...defaultProps} cutouts={threeCutouts} selectedIds={['a', 'b', 'c']} />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.distributeV'));

    expect(onUpdateBatch).toHaveBeenCalledTimes(1);
    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    for (const id of ['a', 'b', 'c']) {
      expect(updates.get(id)).toEqual(expect.objectContaining({ y: expect.any(Number) }));
    }
  });

  it('renders center-in-bin button', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutouts.centerInBin')).toBeInTheDocument();
  });

  it('batches one update per cutout when centering in bin', () => {
    render(<AlignmentToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.centerInBin'));

    expect(onUpdateBatch).toHaveBeenCalledTimes(1);
    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    for (const id of ['a', 'b']) {
      expect(updates.get(id)).toEqual(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      );
    }
  });
});
