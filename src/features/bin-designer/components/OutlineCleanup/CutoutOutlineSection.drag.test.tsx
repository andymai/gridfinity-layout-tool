import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { NO_CLEANUP, type CleanupSettings } from '@/shared/outlineCleanup';
import { resetAllStores } from '@/test/testUtils';
import { CutoutOutlineSection } from './CutoutOutlineSection';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// The controls stand in for a slider mid-drag: each call is one step of it.
const controls = vi.hoisted(() => ({
  change: null as ((next: CleanupSettings, done: boolean) => void) | null,
}));
vi.mock('./OutlineCleanupControls', () => ({
  OutlineCleanupControls: ({
    onChange,
  }: {
    onChange: (next: CleanupSettings, done: boolean) => void;
  }) => {
    controls.change = onChange;
    return null;
  },
}));

const corner = (x: number, y: number) => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

const CUTOUT: Cutout = {
  id: 'p',
  shape: 'path',
  x: 0,
  y: 0,
  width: 40,
  depth: 30,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  path: [corner(0, 0), corner(40, 0), corner(40, 30), corner(0, 30)],
};

describe('CutoutOutlineSection drag', () => {
  beforeEach(() => resetAllStores());

  // Only the first change inside a transaction bumps the epoch, so a drag of
  // several steps would leave the model at its first value.
  it('regenerates the model for a drag of several steps, as one undo step', () => {
    render(<CutoutOutlineSection cutout={CUTOUT} onUpdate={vi.fn()} />);
    const before = useDesignerStore.getState();
    const epoch = before.generation.epoch;
    const past = before.history.past.length;

    act(() => controls.change?.({ ...NO_CLEANUP, simplify: 0.1 }, false));
    act(() => controls.change?.({ ...NO_CLEANUP, simplify: 0.2 }, false));
    act(() => controls.change?.({ ...NO_CLEANUP, simplify: 0.2 }, true));

    const after = useDesignerStore.getState();
    expect(after.generation.epoch).toBe(epoch + 2);
    expect(after.history.past.length).toBe(past + 1);
    expect(after.transactionDepth).toBe(0);
  });

  it('leaves a single step to the transaction’s own regeneration', () => {
    render(<CutoutOutlineSection cutout={CUTOUT} onUpdate={vi.fn()} />);
    const epoch = useDesignerStore.getState().generation.epoch;
    act(() => controls.change?.({ ...NO_CLEANUP, curves: true }, true));
    expect(useDesignerStore.getState().generation.epoch).toBe(epoch + 1);
  });
});
