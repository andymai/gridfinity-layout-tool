import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import type { Cutout, GroupOp } from '@/features/bin-designer/types';
import { PathfinderControls } from './PathfinderControls';
import { resolveActiveOp } from './pathfinderHelpers';

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
  onGroup?: (ids: readonly string[], op: GroupOp) => void;
  onSetGroupOp?: (groupId: string, op: GroupOp) => void;
  disabled?: boolean;
}) {
  const onGroup = props.onGroup ?? vi.fn();
  const onSetGroupOp = props.onSetGroupOp ?? vi.fn();
  render(
    <LocaleProvider initialLocale="en">
      <PathfinderControls
        selectedIds={props.selectedIds}
        cutouts={props.cutouts}
        onGroup={onGroup}
        onSetGroupOp={onSetGroupOp}
        disabled={props.disabled}
      />
    </LocaleProvider>
  );
  return { onGroup, onSetGroupOp };
}

describe('resolveActiveOp', () => {
  it('returns null when nothing is selected', () => {
    expect(resolveActiveOp([], [])).toBeNull();
  });

  it('returns null when the selection is not grouped', () => {
    const cs = [cutout({ id: 'a' }), cutout({ id: 'b' })];
    expect(resolveActiveOp(['a', 'b'], cs)).toBeNull();
  });

  it('returns the op when the selection is exactly one full group', () => {
    const cs = [
      cutout({ id: 'a', groupId: 'g1', groupOp: 'subtract' }),
      cutout({ id: 'b', groupId: 'g1', groupOp: 'subtract' }),
    ];
    expect(resolveActiveOp(['a', 'b'], cs)).toEqual({ groupId: 'g1', op: 'subtract' });
  });

  it('returns null when the selection spans two groups', () => {
    const cs = [
      cutout({ id: 'a', groupId: 'g1', groupOp: 'union' }),
      cutout({ id: 'b', groupId: 'g2', groupOp: 'intersect' }),
    ];
    expect(resolveActiveOp(['a', 'b'], cs)).toBeNull();
  });

  it('returns null when the selection covers only part of a group', () => {
    const cs = [
      cutout({ id: 'a', groupId: 'g1', groupOp: 'union' }),
      cutout({ id: 'b', groupId: 'g1', groupOp: 'union' }),
      cutout({ id: 'c', groupId: 'g1', groupOp: 'union' }),
    ];
    expect(resolveActiveOp(['a', 'b'], cs)).toBeNull();
  });

  it('treats missing groupOp as union', () => {
    const cs = [cutout({ id: 'a', groupId: 'g1' }), cutout({ id: 'b', groupId: 'g1' })];
    expect(resolveActiveOp(['a', 'b'], cs)?.op).toBe('union');
  });
});

describe('PathfinderControls', () => {
  it('disables every op button when fewer than 2 cutouts are selected', () => {
    renderControls({ selectedIds: ['a'], cutouts: [cutout({ id: 'a' })] });
    for (const name of ['Unite', 'Minus Front', 'Intersect', 'Exclude']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('groups the selection with the chosen op when no group exists yet', async () => {
    const onGroup = vi.fn();
    const onSetGroupOp = vi.fn();
    const cs = [cutout({ id: 'a' }), cutout({ id: 'b', x: 30 })];
    renderControls({ selectedIds: ['a', 'b'], cutouts: cs, onGroup, onSetGroupOp });

    await userEvent.click(screen.getByRole('button', { name: 'Minus Front' }));

    expect(onGroup).toHaveBeenCalledWith(['a', 'b'], 'subtract');
    expect(onSetGroupOp).not.toHaveBeenCalled();
  });

  it('flips the op on an existing group instead of regrouping', async () => {
    const onGroup = vi.fn();
    const onSetGroupOp = vi.fn();
    const cs = [
      cutout({ id: 'a', groupId: 'g1', groupOp: 'union' }),
      cutout({ id: 'b', groupId: 'g1', groupOp: 'union' }),
    ];
    renderControls({ selectedIds: ['a', 'b'], cutouts: cs, onGroup, onSetGroupOp });

    await userEvent.click(screen.getByRole('button', { name: 'Intersect' }));

    expect(onSetGroupOp).toHaveBeenCalledWith('g1', 'intersect');
    expect(onGroup).not.toHaveBeenCalled();
  });

  it('no-ops when clicking the already-active op', async () => {
    const onGroup = vi.fn();
    const onSetGroupOp = vi.fn();
    const cs = [
      cutout({ id: 'a', groupId: 'g1', groupOp: 'exclude' }),
      cutout({ id: 'b', groupId: 'g1', groupOp: 'exclude' }),
    ];
    renderControls({ selectedIds: ['a', 'b'], cutouts: cs, onGroup, onSetGroupOp });

    await userEvent.click(screen.getByRole('button', { name: 'Exclude' }));

    expect(onSetGroupOp).not.toHaveBeenCalled();
    expect(onGroup).not.toHaveBeenCalled();
  });

  it('marks the active op with aria-pressed', () => {
    const cs = [
      cutout({ id: 'a', groupId: 'g1', groupOp: 'subtract' }),
      cutout({ id: 'b', groupId: 'g1', groupOp: 'subtract' }),
    ];
    renderControls({ selectedIds: ['a', 'b'], cutouts: cs });

    expect(screen.getByRole('button', { name: 'Minus Front' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Unite' })).toHaveAttribute('aria-pressed', 'false');
  });
});
