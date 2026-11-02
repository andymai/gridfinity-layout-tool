import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Bounds } from '../geometryCore';
import type { Cutout } from '@/features/bin-designer/types';
import { IssueFrames3D } from './IssueFrames3D';

vi.mock('./OffBoardBounds3D', () => ({
  OffBoardBounds3D: ({ bounds, dashed }: { bounds: Bounds; dashed?: boolean }) => (
    <div data-testid="frame" data-minx={bounds.minX} data-dashed={String(dashed)} />
  ),
}));

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const array = {
  mode: 'grid' as const,
  cols: 3,
  rows: 1,
  pitchX: 25,
  pitchY: 0,
  count: 3,
  radius: 0,
  startAngle: 0,
  rotateToCenter: false,
};

describe('IssueFrames3D', () => {
  it('frames only the named copies of a repeat, dashed', () => {
    render(
      <IssueFrames3D
        cutouts={[cutout({ array })]}
        instanceIds={new Set(['c::a1'])}
        preview={new Map()}
      />
    );
    const frames = screen.getAllByTestId('frame');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute('data-minx', '35');
    expect(frames[0]).toHaveAttribute('data-dashed', 'true');
  });

  it('follows a shape while it is dragged', () => {
    render(
      <IssueFrames3D
        cutouts={[cutout()]}
        instanceIds={new Set(['c'])}
        preview={new Map([['c', { x: 40 }]])}
      />
    );
    expect(screen.getByTestId('frame')).toHaveAttribute('data-minx', '40');
  });

  // A legacy group can hold its repeat on one member; the others are copied on it.
  it("frames a copy a group member inherits from another's repeat", () => {
    const members = [
      cutout({ id: 'm1', groupId: 'g', groupOp: 'union', array }),
      cutout({ id: 'm2', groupId: 'g', groupOp: 'union', x: 12 }),
    ];
    render(
      <IssueFrames3D cutouts={members} instanceIds={new Set(['m2::a1'])} preview={new Map()} />
    );
    expect(screen.getByTestId('frame')).toHaveAttribute('data-minx', '37');
  });

  it('draws nothing for hidden shapes or an empty set', () => {
    const { container, rerender } = render(
      <IssueFrames3D
        cutouts={[cutout({ hidden: true })]}
        instanceIds={new Set(['c'])}
        preview={new Map()}
      />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<IssueFrames3D cutouts={[cutout()]} instanceIds={new Set()} preview={new Map()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
