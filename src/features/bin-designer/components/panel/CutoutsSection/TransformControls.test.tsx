import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import { TransformControls } from './TransformControls';
import { buildGroupRotationUpdates } from './pathfinderHelpers';

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

function renderControls(props: {
  selectedIds: readonly string[];
  cutouts: readonly Cutout[];
  onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
}) {
  const onUpdateBatch = props.onUpdateBatch ?? vi.fn();
  render(
    <LocaleProvider initialLocale="en">
      <TransformControls
        selectedIds={props.selectedIds}
        cutouts={props.cutouts}
        binWidth={200}
        binDepth={200}
        onUpdateBatch={onUpdateBatch}
      />
    </LocaleProvider>
  );
  return { onUpdateBatch };
}

describe('buildGroupRotationUpdates', () => {
  it('rotates a single cutout in place around its own center', () => {
    const c = cutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10, rotation: 0 });
    const updates = buildGroupRotationUpdates([c], 90, 200, 200);
    expect(updates.get('a')?.rotation).toBe(90);
    // Single-member bbox center == cutout center, so x/y stay put.
    expect(updates.get('a')?.x).toBeCloseTo(0, 5);
    expect(updates.get('a')?.y).toBeCloseTo(0, 5);
  });

  it('rotates around the bounding box center of the selection', () => {
    const a = cutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10 });
    const b = cutout({ id: 'b', x: 20, y: 0, width: 10, depth: 10 });
    // Bounding-box center is (15, 5); a's center starts at (5, 5), b at (25, 5).
    const updates = buildGroupRotationUpdates([a, b], 180, 200, 200);
    // After 180° around (15, 5): a's center -> (25, 5), b's center -> (5, 5).
    expect(updates.get('a')?.x).toBeCloseTo(20, 5);
    expect(updates.get('b')?.x).toBeCloseTo(0, 5);
  });

  it('skips locked cutouts', () => {
    const a = cutout({ id: 'a', locked: true });
    const updates = buildGroupRotationUpdates([a], 90, 200, 200);
    expect(updates.size).toBe(0);
  });

  it('clamps rotation against the post-rotation position, not the starting one', () => {
    // Group: a sits near the right wall; b sits left of center. A 180° rotation
    // around the group center sends a to the left edge — clamping must check
    // the cutout in its *new* position, not the original right-wall position,
    // or the bin-bounds check is evaluated against the wrong AABB and the
    // angle can stay at 180° even when the rotated AABB would overflow.
    const binWidth = 100;
    const binDepth = 100;
    const a = cutout({ id: 'a', x: 80, y: 45, width: 10, depth: 10, rotation: 0 });
    const b = cutout({ id: 'b', x: 10, y: 45, width: 10, depth: 10, rotation: 0 });
    const updates = buildGroupRotationUpdates([a, b], 180, binWidth, binDepth);
    // After 180° around the group's center (50, 50), a's center moves from
    // (85, 50) to (15, 50) and b's from (15, 50) to (85, 50). Both fit at
    // 180° when the bounds check uses the new position. The old code clamped
    // against the *original* position; with a near the right wall, clamping
    // against the old x=80 would reject the angle even though the rotated
    // cutout now sits at x=10 and clearly fits.
    expect(updates.get('a')?.x).toBeCloseTo(10, 5);
    expect(updates.get('b')?.x).toBeCloseTo(80, 5);
    expect(updates.get('a')?.rotation).toBe(180);
    expect(updates.get('b')?.rotation).toBe(180);
  });
});

describe('TransformControls', () => {
  it('flips the selection horizontally when the H button is clicked', async () => {
    const onUpdateBatch = vi.fn();
    const cs = [cutout({ id: 'a', x: 0 }), cutout({ id: 'b', x: 20 })];
    renderControls({ selectedIds: ['a', 'b'], cutouts: cs, onUpdateBatch });
    await userEvent.click(screen.getByRole('button', { name: 'Flip Horizontal' }));
    expect(onUpdateBatch).toHaveBeenCalledTimes(1);
    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    // Selection bounds = [0, 30], center = 15. Each cutout mirrors around 15.
    // a (x=0, w=10): right edge 10 → mirror to 20 → new x = 20.
    // b (x=20, w=10): right edge 30 → mirror to 0 → new x = 0.
    expect(updates.get('a')?.x).toBeCloseTo(20, 5);
    expect(updates.get('b')?.x).toBeCloseTo(0, 5);
  });

  it('rotates by the typed angle on Enter', async () => {
    const onUpdateBatch = vi.fn();
    // Place the cutout away from the bin edges so 45° rotation doesn't get
    // clamped by `clampRotationToBounds` (rotated AABB grows by ~√2).
    const cs = [cutout({ id: 'a', x: 90, y: 90 })];
    renderControls({ selectedIds: ['a'], cutouts: cs, onUpdateBatch });

    const input = screen.getByRole('spinbutton', { name: 'Rotation' });
    await userEvent.type(input, '45{Enter}');

    expect(onUpdateBatch).toHaveBeenCalled();
    const updates = onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    expect(updates.get('a')?.rotation).toBe(45);
  });

  it('disables all controls with no selection', () => {
    renderControls({ selectedIds: [], cutouts: [] });
    expect(screen.getByRole('button', { name: 'Flip Horizontal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rotate 90°' })).toBeDisabled();
  });
});
