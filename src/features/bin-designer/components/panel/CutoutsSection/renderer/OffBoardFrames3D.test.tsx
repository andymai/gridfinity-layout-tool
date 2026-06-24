import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Bounds } from '../geometryCore';
import type { Cutout } from '@/features/bin-designer/types';
import { OffBoardFrames3D } from './OffBoardFrames3D';

// Stub the R3F leaf so the framing/filtering logic can be asserted in jsdom
// without a WebGL canvas.
vi.mock('./OffBoardBounds3D', () => ({
  OffBoardBounds3D: ({ bounds }: { bounds: Bounds }) => (
    <div data-testid="frame" data-minx={bounds.minX} data-maxx={bounds.maxX} />
  ),
}));

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
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
  locked: false,
  hidden: false,
  ...overrides,
});

const gridArray = (cols: number, rows: number, pitchX: number, pitchY: number) =>
  ({
    mode: 'grid',
    cols,
    rows,
    pitchX,
    pitchY,
    count: 1,
    radius: 0,
    startAngle: 0,
    rotateToCenter: false,
  }) as const;

const BIN_W = 100;
const BIN_D = 80;
const EMPTY_PREVIEW = new Map<string, Partial<Cutout>>();

const renderFrames = (cutouts: Cutout[], offBoardIds: Set<string>) =>
  render(
    <OffBoardFrames3D
      cutouts={cutouts}
      offBoardIds={offBoardIds}
      preview={EMPTY_PREVIEW}
      binWidth={BIN_W}
      binDepth={BIN_D}
    />
  );

describe('OffBoardFrames3D', () => {
  it('renders nothing when no cutouts are flagged', () => {
    renderFrames([createCutout({ id: 'a', x: 95 })], new Set());
    expect(screen.queryAllByTestId('frame')).toHaveLength(0);
  });

  it('frames a flagged single cutout but skips hidden ones', () => {
    const visible = createCutout({ id: 'vis', x: 95, y: 10 });
    const hidden = createCutout({ id: 'hid', x: 95, y: 40, hidden: true });
    renderFrames([visible, hidden], new Set(['vis', 'hid']));
    const frames = screen.getAllByTestId('frame');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute('data-maxx', '115');
  });

  it('frames only the off-board instances of an array, not the in-bounds master', () => {
    // Master at 70..90 fits; the second grid instance lands at 110..130.
    const arr = createCutout({ id: 'arr', x: 70, y: 10, array: gridArray(2, 1, 40, 40) });
    renderFrames([arr], new Set(['arr']));
    const frames = screen.getAllByTestId('frame');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute('data-minx', '110');
  });
});
