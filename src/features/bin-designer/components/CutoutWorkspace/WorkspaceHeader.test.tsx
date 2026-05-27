import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WorkspaceHeader } from './WorkspaceHeader';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn(),
}));

vi.mock('../panel/CutoutsSection/geometry', () => ({
  computeBounds: vi.fn(() => ({ minX: 0, minY: 0, maxX: 10, maxY: 10 })),
  getEffectiveBounds: vi.fn((c: { x: number; y: number; width: number; depth: number }) => ({
    minX: c.x,
    minY: c.y,
    maxX: c.x + c.width,
    maxY: c.y + c.depth,
  })),
  getEffectiveDepth: vi.fn((c: { depth: number }) => c.depth),
  distributeHorizontally: vi.fn(() => ({})),
  distributeVertically: vi.fn(() => ({})),
  centerInBin: vi.fn(() => ({})),
}));

vi.mock('../panel/CutoutsSection/autoArrange', () => ({
  autoArrangeCutouts: vi.fn(() => ({})),
}));

const defaultProps = {
  zoomPercent: 100,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onFitToView: vi.fn(),
  cutouts: [],
  selection: new Set<string>(),
  binWidth: 40,
  binDepth: 40,
  onUpdate: vi.fn(),
  onUpdateBatch: vi.fn(),
  onRemove: vi.fn(),
  onDuplicate: vi.fn(),
  onGroup: vi.fn(),
  onUngroup: vi.fn(),
  onSetGroupOp: vi.fn(),
  onReorder: vi.fn(),
  onClearAll: vi.fn(),
};

describe('WorkspaceHeader', () => {
  beforeEach(() => {
    vi.mocked(useDesignerStore).mockReturnValue(vi.fn());
  });

  it('renders the workspace title', () => {
    render(<WorkspaceHeader {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutoutEditor.title')).toBeInTheDocument();
  });

  it('displays the zoom percentage', () => {
    render(<WorkspaceHeader {...defaultProps} zoomPercent={125} />);
    expect(screen.getByText('125%')).toBeInTheDocument();
  });

  it('renders zoom control buttons', () => {
    render(<WorkspaceHeader {...defaultProps} />);
    expect(screen.getByTitle('binDesigner.cutoutEditor.zoomIn')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutoutEditor.zoomOut')).toBeInTheDocument();
  });

  it('renders the done button', () => {
    render(<WorkspaceHeader {...defaultProps} />);
    expect(screen.getByText('binDesigner.cutoutEditor.done')).toBeInTheDocument();
  });

  it('shows clear all when cutouts exist and nothing selected', () => {
    const cutout = {
      id: 'c1',
      shape: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 10,
      depth: 10,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
      locked: false,
      hidden: false,
    };
    render(<WorkspaceHeader {...defaultProps} cutouts={[cutout]} />);
    expect(screen.getByText('binDesigner.cutouts.clearAll')).toBeInTheDocument();
  });

  it('shows duplicate and delete for single selection', () => {
    const cutout = {
      id: 'c1',
      shape: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 10,
      depth: 10,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
      locked: false,
      hidden: false,
    };
    render(<WorkspaceHeader {...defaultProps} cutouts={[cutout]} selection={new Set(['c1'])} />);
    expect(screen.getByText('common.duplicate')).toBeInTheDocument();
    expect(screen.getByText('common.delete')).toBeInTheDocument();
  });

  it('shows alignment buttons for multi-selection', () => {
    const cutouts = [
      {
        id: 'c1',
        shape: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 10,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
        locked: false,
        hidden: false,
      },
      {
        id: 'c2',
        shape: 'rectangle' as const,
        x: 15,
        y: 15,
        width: 10,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
        locked: false,
        hidden: false,
      },
    ];
    render(
      <WorkspaceHeader {...defaultProps} cutouts={cutouts} selection={new Set(['c1', 'c2'])} />
    );
    expect(screen.getByTitle('binDesigner.cutouts.alignLeft')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.alignRight')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.centerInBin')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.pathfinder.union')).toBeInTheDocument();
  });
});
