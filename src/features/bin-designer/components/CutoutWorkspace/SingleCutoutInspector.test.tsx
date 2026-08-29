import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SingleCutoutInspector } from './SingleCutoutInspector';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
    x: 5,
    y: 5,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function renderit(cutout: Cutout) {
  return render(
    <SingleCutoutInspector
      cutout={cutout}
      preview={new Map()}
      binWidth={100}
      binDepth={100}
      maxCutDepth={20}
      onUpdate={vi.fn()}
      disabled={false}
    />
  );
}

describe('SingleCutoutInspector', () => {
  it('renders the core property sections', () => {
    renderit(makeCutout());
    expect(screen.getByText('binDesigner.cutouts.section.transform')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.section.shape')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.section.label')).toBeInTheDocument();
  });

  // An oversize cutout puts every transform field past its ceiling: W/H
  // hold a measurement the board can't contain, and X/Y have no valid offset
  // left at all, so their max collapses to 0 while the stored offset stands.
  // Every slider must still announce a range that contains its own value.
  // (That `softMax` is wired is covered by the commit test below, not here —
  // these values come from the cutout, not from the field.)
  it('announces a valid slider range for a cutout larger than the board', () => {
    renderit(makeCutout({ shape: 'rectangle', x: 20, y: 20, width: 156, depth: 156 }));
    for (const [label, now] of [
      ['W', '156'],
      ['H', '156'],
      ['X', '20'],
      ['Y', '20'],
    ] as const) {
      const spin = screen.getByRole('spinbutton', { name: label });
      expect(spin).toHaveAttribute('aria-valuenow', now);
      expect(spin).toHaveAttribute('aria-valuemax', now);
    }
  });

  it('commits a typed W past the board instead of truncating it', () => {
    const onUpdate = vi.fn();
    render(
      <SingleCutoutInspector
        cutout={makeCutout({ shape: 'rectangle' })}
        preview={new Map()}
        binWidth={123.1}
        binDepth={123.1}
        maxCutDepth={20}
        onUpdate={onUpdate}
        disabled={false}
      />
    );

    const input = screen.getByRole('spinbutton', { name: 'W' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '156' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Center-anchored: the 10-wide cutout at x=5 is centered on 10, so a
    // 156-wide box keeps that center and starts at -68. Deliberately off-board;
    // the clipping warning offers grow / center / bring-back-in.
    expect(onUpdate).toHaveBeenCalledWith('c1', { width: 156, depth: 10, x: -68, y: 5 });
  });

  // The router-bit case from the issue: only the size was meant to change, so
  // the hole must not walk out from under the part it was drilled for.
  it('holds a cutout center when a typed size changes', () => {
    const onUpdate = vi.fn();
    render(
      <SingleCutoutInspector
        cutout={makeCutout({ x: 20, y: 20, width: 6.35, depth: 6.35 })}
        preview={new Map()}
        binWidth={100}
        binDepth={100}
        maxCutDepth={20}
        onUpdate={onUpdate}
        disabled={false}
      />
    );

    const input = screen.getByRole('spinbutton', { name: 'W' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.7' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const patch = onUpdate.mock.calls[0][1] as { x: number; width: number };
    expect(patch.width).toBe(12.7);
    expect(patch.x + patch.width / 2).toBeCloseTo(20 + 6.35 / 2, 10);
  });

  it('holds the center on the H axis too, leaving X alone', () => {
    const onUpdate = vi.fn();
    render(
      <SingleCutoutInspector
        cutout={makeCutout({ shape: 'rectangle', x: 20, y: 20, width: 10, depth: 10 })}
        preview={new Map()}
        binWidth={100}
        binDepth={100}
        maxCutDepth={20}
        onUpdate={onUpdate}
        disabled={false}
      />
    );

    const input = screen.getByRole('spinbutton', { name: 'H' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith('c1', { width: 10, depth: 30, x: 20, y: 10 });
  });

  // The fields render preview-merged values, so the center must be taken from
  // the same box — anchoring on the stored one would re-center a shape onto a
  // position the user cannot see.
  it('anchors on the previewed box, not the stored one', () => {
    const onUpdate = vi.fn();
    render(
      <SingleCutoutInspector
        cutout={makeCutout({ shape: 'rectangle', x: 5, y: 5, width: 10, depth: 10 })}
        preview={new Map([['c1', { x: 40, width: 20 }]])}
        binWidth={100}
        binDepth={100}
        maxCutDepth={20}
        onUpdate={onUpdate}
        disabled={false}
      />
    );

    const input = screen.getByRole('spinbutton', { name: 'W' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Previewed box is 20 wide at x=40, centered on 50; a 40-wide box keeps
    // that center and starts at 30. Anchoring on the stored 10-wide box at x=5
    // would have produced -10.
    expect(onUpdate).toHaveBeenCalledWith('c1', { width: 40, depth: 10, x: 30, y: 5 });
  });

  it('shows the Repeat section with its presets for a repeatable shape', () => {
    renderit(makeCutout({ shape: 'circle' }));
    expect(screen.getByText('binDesigner.cutouts.section.repeat')).toBeInTheDocument();
    expect(screen.getByTestId('repeat-preset-grid3x2')).toBeInTheDocument();
  });

  it('keeps the section for a path but states why it is unavailable', () => {
    renderit(makeCutout({ shape: 'path' }));
    // Present, not vanished: a control that disappears without explanation
    // reads as a bug rather than as a rule.
    expect(screen.getByText('binDesigner.cutouts.section.repeat')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.repeat.blockedPath')).toBeInTheDocument();
    expect(screen.queryByTestId('repeat-preset-grid3x2')).not.toBeInTheDocument();
  });

  it('offers a way out when the shape is only blocked by grouping', () => {
    renderit(makeCutout({ shape: 'circle', groupId: 'g1' }));
    expect(screen.getByText('binDesigner.cutouts.repeat.blockedGrouped')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.ungroup')).toBeInTheDocument();
  });
});
