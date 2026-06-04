import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InspectorContent } from './InspectorContent';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/components/CompactNumberInput', () => ({
  CompactNumberInput: ({
    label,
    value,
    indeterminate,
  }: {
    label: string;
    value: number;
    indeterminate?: boolean;
  }) => (
    <input
      data-testid={`compact-input-${label}`}
      data-label={label}
      data-indeterminate={indeterminate ? 'true' : 'false'}
      value={value}
      readOnly
    />
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

describe('InspectorContent', () => {
  it('renders an empty placeholder when nothing is selected', () => {
    render(<InspectorContent {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutoutEditor.inspectorEmptyTitle')).toBeInTheDocument();
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
    expect(
      screen.getByTestId('compact-input-binDesigner.cutouts.cornerRadius')
    ).toBeInTheDocument();

    rerender(
      <InspectorContent
        {...defaultProps}
        cutouts={[createCutout({ shape: 'circle' })]}
        selection={new Set(['cutout1'])}
      />
    );
    expect(
      screen.queryByTestId('compact-input-binDesigner.cutouts.cornerRadius')
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
    // X/Y/W/H are single-selection only
    expect(screen.queryByTestId('compact-input-X')).not.toBeInTheDocument();
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
