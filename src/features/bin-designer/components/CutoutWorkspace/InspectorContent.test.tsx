import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectorContent } from './InspectorContent';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// Mirrors the real input's commit clamp (NumberField.tsx `clampTyped`).
// A pass-through mock would report 156 whether or not `softMax` is wired, so the
// oversize-W test below would pass against the old truncating behaviour too.
vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  NumberField: ({
    label,
    value,
    indeterminate,
    onChange,
    min = 0,
    max = Infinity,
    softMax = false,
  }: {
    label: string;
    value: number;
    indeterminate?: boolean;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    softMax?: boolean;
  }) => (
    <input
      data-testid={`compact-input-${label}`}
      data-label={label}
      data-indeterminate={indeterminate ? 'true' : 'false'}
      value={value}
      onChange={(e) => {
        const v = Number(e.target.value);
        // `Math.max(max, value)` mirrors the real ceiling: it never falls below
        // the value already held, so focusing a field cannot destroy it.
        onChange?.(Math.max(min, Math.min(softMax ? Infinity : Math.max(max, value), v)));
      }}
    />
  ),
  SliderInput: ({ label, value }: { label: string; value: number }) => (
    <input data-testid={`slider-input-${label}`} data-label={label} value={value} readOnly />
  ),
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

vi.mock('./BinSizeSection', () => ({
  BinSizeSection: ({
    offBoardCount,
    onClampOffBoard,
  }: {
    offBoardCount: number;
    onClampOffBoard?: () => void;
  }) => (
    <div data-testid="bin-size-section" data-off-board-count={offBoardCount}>
      {onClampOffBoard && (
        <button type="button" onClick={onClampOffBoard}>
          clamp
        </button>
      )}
    </div>
  ),
}));

// Stubbed for the same reason as BinSizeSection: it is self-wired to the
// designer store, and this suite is about what InspectorContent renders in each
// selection state, not what the store holds.
vi.mock('./BinFeaturesSection', () => ({
  BinFeaturesSection: () => <div data-testid="bin-features-section" />,
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

const defaultProps = {
  cutouts: [] as Cutout[],
  selection: new Set<string>(),
  preview: new Map<string, Partial<Cutout>>(),
  binWidth: 100,
  binDepth: 100,
  maxCutDepth: 10,
  onUpdate: vi.fn(),
  disabled: false,
};

describe('InspectorContent - group repeat', () => {
  const grouped = (over: Partial<Cutout> = {}): Cutout =>
    createCutout({ groupId: 'g1', groupOp: 'exclude', ...over });

  const pair = [
    grouped({ id: 'outer', x: 5, y: 5, width: 26, depth: 20 }),
    grouped({ id: 'inner', x: 11, y: 9, width: 14, depth: 12 }),
  ];

  it('offers Repeat when the selection is a whole group', () => {
    render(
      <InspectorContent {...defaultProps} cutouts={pair} selection={new Set(['outer', 'inner'])} />
    );
    expect(screen.getByText('binDesigner.cutouts.section.repeat')).toBeInTheDocument();
  });

  it('does not offer it for a partial selection of that group', () => {
    // Half a group would write a repeat onto a member the user cannot see they
    // are editing.
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[...pair, grouped({ id: 'third', x: 40, y: 5 })]}
        selection={new Set(['outer', 'inner'])}
      />
    );
    expect(screen.queryByText('binDesigner.cutouts.section.repeat')).toBeNull();
  });

  it('does not offer it for a loose multi-selection', () => {
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout({ id: 'a' }), createCutout({ id: 'b', x: 50 })]}
        selection={new Set(['a', 'b'])}
      />
    );
    expect(screen.queryByText('binDesigner.cutouts.section.repeat')).toBeNull();
  });

  it('refuses a group holding a path, which cannot be repeated', () => {
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[pair[0], grouped({ id: 'p', shape: 'path' })]}
        selection={new Set(['outer', 'p'])}
      />
    );
    expect(screen.getByText('binDesigner.cutouts.repeat.blockedPath')).toBeInTheDocument();
  });
});

describe('InspectorContent', () => {
  it('renders an empty placeholder when nothing is selected', () => {
    render(<InspectorContent {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutoutEditor.inspectorEmptyTitle')).toBeInTheDocument();
  });

  it('always renders the bin-size section and forwards the off-board count', () => {
    const { rerender } = render(<InspectorContent {...defaultProps} offBoardCount={3} />);
    expect(screen.getByTestId('bin-size-section')).toHaveAttribute('data-off-board-count', '3');

    rerender(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout()]}
        selection={new Set(['cutout1'])}
        offBoardCount={0}
      />
    );
    expect(screen.getByTestId('bin-size-section')).toBeInTheDocument();
  });

  // Bin-level controls are the ones you must not have to change selection to
  // reach — the stacking lip included, which is why it lives here rather than
  // in the no-selection board settings.
  it.each([
    ['nothing selected', [] as Cutout[], new Set<string>()],
    ['a single selection', [createCutout()], new Set(['cutout1'])],
    [
      'a multi-selection',
      [createCutout({ id: 'a' }), createCutout({ id: 'b' })],
      new Set(['a', 'b']),
    ],
  ])('keeps the bin-features controls on screen with %s', (_label, cutouts, selection) => {
    render(<InspectorContent {...defaultProps} cutouts={cutouts} selection={selection} />);
    expect(screen.getByTestId('bin-features-section')).toBeInTheDocument();
  });

  it('renders X/Y/W/H inputs and rotation/depth sliders for a single selection', () => {
    const cutout = createCutout();
    render(
      <InspectorContent {...defaultProps} cutouts={[cutout]} selection={new Set(['cutout1'])} />
    );
    expect(screen.getByTestId('compact-input-X')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-Y')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-W')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-H')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.rotation')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.cutDepth')).toBeInTheDocument();
  });

  it('shows the corner-radius slider only for rectangles', () => {
    const { rerender } = render(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout({ shape: 'rectangle' })]}
        selection={new Set(['cutout1'])}
      />
    );
    expect(screen.getByTestId('slider-input-binDesigner.cutouts.cornerRadius')).toBeInTheDocument();

    rerender(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout({ shape: 'circle' })]}
        selection={new Set(['cutout1'])}
      />
    );
    expect(
      screen.queryByTestId('slider-input-binDesigner.cutouts.cornerRadius')
    ).not.toBeInTheDocument();
  });

  it('renders shared rotation/depth sliders for a multi-selection', () => {
    const a = createCutout({ id: 'a' });
    const b = createCutout({ id: 'b' });
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[a, b]}
        selection={new Set(['a', 'b'])}
        onUpdateBatch={vi.fn()}
      />
    );
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.rotation')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.cutDepth')).toBeInTheDocument();
    // X/Y/W/H are batch-editable too as of — see the multi-select suite
    // below for the per-cutout clamping they apply.
    expect(screen.getByTestId('compact-input-X')).toBeInTheDocument();
  });

  it('shows the locked badge when the selected cutout is locked', () => {
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout({ locked: true })]}
        selection={new Set(['cutout1'])}
      />
    );
    expect(screen.getByText('binDesigner.cutoutEditor.locked')).toBeInTheDocument();
  });

  it('respects preview overrides for displayed values', () => {
    const cutout = createCutout({ x: 10 });
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[cutout]}
        selection={new Set(['cutout1'])}
        preview={new Map([['cutout1', { x: 42 }]])}
      />
    );
    expect(screen.getByTestId('compact-input-X')).toHaveValue('42');
  });

  it('renders board settings in the empty state when a board is provided', () => {
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout()]}
        board={{
          gridSize: 0.5,
          onGridSizeChange: vi.fn(),
          snapEnabled: true,
          onSnapToggle: vi.fn(),
        }}
      />
    );
    // Board footprint from binWidth × binDepth, plus the placeholder is gone.
    expect(screen.getByText('100 × 100 mm')).toBeInTheDocument();
    expect(
      screen.queryByText('binDesigner.cutoutEditor.inspectorEmptyTitle')
    ).not.toBeInTheDocument();
  });

  it('marks a multi-select field as indeterminate when values differ', () => {
    const a = createCutout({ id: 'a', rotation: 0, cutDepth: 5 });
    const b = createCutout({ id: 'b', rotation: 90, cutDepth: 5 });
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[a, b]}
        selection={new Set(['a', 'b'])}
        onUpdateBatch={vi.fn()}
      />
    );
    // rotation differs → indeterminate; cutDepth matches → not.
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.rotation')).toHaveAttribute(
      'data-indeterminate',
      'true'
    );
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.cutDepth')).toHaveAttribute(
      'data-indeterminate',
      'false'
    );
  });
});

// The multi-select surface gained align/distribute plus the position, size and
// chamfer fields the reporter asked for in.
describe('InspectorContent multi-select editing', () => {
  const two = [
    createCutout({ id: 'a', x: 0, y: 0, width: 20, depth: 20 }),
    createCutout({ id: 'b', x: 50, y: 50, width: 10, depth: 10 }),
  ];

  function renderMulti(cutouts: Cutout[], onUpdateBatch = vi.fn()) {
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={cutouts}
        selection={new Set(cutouts.map((c) => c.id))}
        onUpdateBatch={onUpdateBatch}
      />
    );
    return onUpdateBatch;
  }

  it('shows align and distribute controls for a multi-selection', () => {
    renderMulti(two);

    expect(
      screen.getByRole('button', { name: 'binDesigner.cutouts.align.left' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'binDesigner.cutouts.distribute.horizontal' })
    ).toBeInTheDocument();
  });

  it('hides align controls for a single selection', () => {
    render(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout()]}
        selection={new Set(['cutout1'])}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'binDesigner.cutouts.align.left' })
    ).not.toBeInTheDocument();
  });

  it('aligns the selection when an align button is pressed', () => {
    const onUpdateBatch = renderMulti(two);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutouts.align.left' }));

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('b')?.x).toBe(0);
  });

  it('marks a mixed field indeterminate and a shared one concrete', () => {
    renderMulti(two);

    // x differs (0 vs 50) → indeterminate; both cutouts share rotation 0.
    expect(screen.getByTestId('compact-input-X')).toHaveAttribute('data-indeterminate', 'true');
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.rotation')).toHaveAttribute(
      'data-indeterminate',
      'false'
    );
  });

  it('clamps a batch X per cutout so a wide shape cannot run past the wall', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'narrow', width: 10 }),
      createCutout({ id: 'wide', width: 80 }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-X'), { target: { value: '95' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    // binWidth is 100, so each cutout stops at 100 - its own width.
    expect(updates.get('narrow')?.x).toBe(90);
    expect(updates.get('wide')?.x).toBe(20);
  });

  // Lock means "cannot be moved, resized, or rotated".
  it('leaves locked cutouts out of position, size and rotation batches', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'free' }),
      createCutout({ id: 'pinned', locked: true }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-X'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('compact-input-binDesigner.cutouts.rotation'), {
      target: { value: '45' },
    });

    for (const call of onUpdateBatch.mock.calls) {
      expect((call[0] as Map<string, Partial<Cutout>>).has('pinned')).toBe(false);
    }
  });

  // Cut depth isn't a transform, so lock doesn't gate it.
  it('still applies cut depth to locked cutouts', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'free' }),
      createCutout({ id: 'pinned', locked: true }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-binDesigner.cutouts.cutDepth'), {
      target: { value: '8' },
    });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('pinned')?.cutDepth).toBe(8);
  });

  it('keeps a batch W past the board instead of truncating the measurement (#3061)', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'a' }),
      createCutout({ id: 'b', width: 40 }),
    ]);

    // binWidth is 100 — the old behaviour silently rewrote this to 100.
    fireEvent.change(screen.getByTestId('compact-input-W'), { target: { value: '156' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('a')?.width).toBe(156);
    expect(updates.get('b')?.width).toBe(156);
  });

  it('still floors a batch W at the minimum cutout size', () => {
    const onUpdateBatch = renderMulti([createCutout({ id: 'a' }), createCutout({ id: 'b' })]);

    fireEvent.change(screen.getByTestId('compact-input-W'), { target: { value: '0.5' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('a')?.width).toBe(2);
  });

  it('pins a batch X to 0 for a cutout wider than the board', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'oversize', width: 156 }),
      createCutout({ id: 'normal' }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-X'), { target: { value: '20' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('oversize')?.x).toBe(0);
  });

  it('skips meshes when batch-resizing, since their geometry is baked', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'rect' }),
      createCutout({ id: 'imported', shape: 'mesh' }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-W'), { target: { value: '30' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.has('rect')).toBe(true);
    expect(updates.has('imported')).toBe(false);
  });

  // The same field on a selection of one holds the shape's center (#3864), so a
  // selection of two has to as well.
  it('holds each cutout’s own center when batch-resizing', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'small', x: 10, y: 10, width: 20, depth: 20 }),
      createCutout({ id: 'large', x: 60, y: 40, width: 40, depth: 40 }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-W'), { target: { value: '30' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    // small: center 20 → 30mm wide starts at 5. large: center 80 → starts at 65.
    expect(updates.get('small')).toMatchObject({ width: 30, x: 5 });
    expect(updates.get('large')).toMatchObject({ width: 30, x: 65 });
    // The untouched axis stays put on both.
    expect(updates.get('small')?.y).toBe(10);
    expect(updates.get('large')?.y).toBe(40);
  });

  it('holds each cutout’s own center when batch-resizing depth', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'a', x: 10, y: 10, width: 20, depth: 20 }),
      createCutout({ id: 'b', x: 10, y: 40, width: 20, depth: 40 }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-H'), { target: { value: '10' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('a')).toMatchObject({ depth: 10, y: 15 });
    expect(updates.get('b')).toMatchObject({ depth: 10, y: 55 });
    expect(updates.get('a')?.x).toBe(10);
  });

  // Flooring at the minimum must not leave the origin where the typed size put it.
  it('re-centers on the floored size when a batch W is below the minimum', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'a', x: 10, y: 0, width: 20, depth: 20 }),
      createCutout({ id: 'b', x: 50, y: 0, width: 20, depth: 20 }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-W'), { target: { value: '0.5' } });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    // Center 20 with a 2mm floor starts at 19, not at the original 10.
    expect(updates.get('a')).toMatchObject({ width: 2, x: 19 });
    expect(updates.get('b')).toMatchObject({ width: 2, x: 59 });
  });

  it('clamps batch chamfer to each cutout’s own cut-depth headroom', () => {
    const onUpdateBatch = renderMulti([
      createCutout({ id: 'deep', cutDepth: 10 }),
      createCutout({ id: 'shallow', cutDepth: 1 }),
    ]);

    fireEvent.change(screen.getByTestId('compact-input-binDesigner.cutouts.chamfer'), {
      target: { value: '3' },
    });

    const updates = onUpdateBatch.mock.calls[0][0] as Map<string, Partial<Cutout>>;
    expect(updates.get('deep')?.chamferWidth).toBe(3);
    // A 1mm cut keeps a 0.2mm straight wall, so 0.8mm is all it can take.
    expect(updates.get('shallow')?.chamferWidth).toBeCloseTo(0.8, 6);
  });

  it('omits the chamfer control when no selected shape accepts one', () => {
    renderMulti([
      createCutout({ id: 'a', shape: 'roundedSlot' as Cutout['shape'] }),
      createCutout({ id: 'b', shape: 'roundedSlot' as Cutout['shape'] }),
    ]);

    expect(
      screen.queryByTestId('compact-input-binDesigner.cutouts.chamfer')
    ).not.toBeInTheDocument();
  });
});
