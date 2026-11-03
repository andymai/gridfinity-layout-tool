import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { cutoutOutlineRing } from '@/shared/utils/cutoutOutline';
import { resetAllStores } from '@/test/testUtils';
import { CutoutOutlineSection } from './CutoutOutlineSection';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

/** A traced L: corners every 1.4 mm along its edges, a little wobble on each. */
function tracedL(): PathPoint[] {
  const corners = [
    [10, 10],
    [70, 10],
    [70, 25],
    [25, 25],
    [25, 65],
    [10, 65],
  ];
  const path: PathPoint[] = [];
  corners.forEach(([ax, ay], i) => {
    const [bx, by] = corners[(i + 1) % corners.length];
    const n = Math.round(Math.hypot(bx - ax, by - ay) / 1.4);
    for (let k = 0; k < n; k++) {
      const j = path.length;
      path.push({
        x: ax + ((bx - ax) * k) / n + 0.15 * Math.sin(j * 1.3),
        y: ay + ((by - ay) * k) / n + 0.15 * Math.cos(j * 0.7),
        handleIn: null,
        handleOut: null,
        symmetric: false,
      });
    }
  });
  return path;
}

function pathCutout(path: PathPoint[], rotation = 0): Cutout {
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  return {
    id: 'traced',
    shape: 'path',
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
    cutDepth: 10,
    rotation,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path,
  };
}

/** Applies each patch to the cutout, as the store does, and reports it. */
function Harness({
  cutout,
  onUpdate,
}: {
  readonly cutout: Cutout;
  readonly onUpdate: (id: string, patch: Partial<Cutout>) => void;
}) {
  const [live, setLive] = useState(cutout);
  const [seen, setSeen] = useState(cutout);
  if (cutout !== seen) {
    setSeen(cutout);
    setLive(cutout);
  }
  return (
    <CutoutOutlineSection
      cutout={live}
      onUpdate={(id, patch) => {
        onUpdate(id, patch);
        setLive((c) => ({ ...c, ...patch }));
      }}
    />
  );
}

function open(cutout: Cutout, onUpdate = vi.fn()) {
  const view = render(<Harness cutout={cutout} onUpdate={onUpdate} />);
  fireEvent.click(screen.getByText('binDesigner.cutouts.outline.section'));
  return { ...view, onUpdate };
}

const lastPatch = (onUpdate: ReturnType<typeof vi.fn>) =>
  onUpdate.mock.calls.at(-1)?.[1] as Partial<Cutout>;

describe('CutoutOutlineSection', () => {
  beforeEach(() => resetAllStores());

  it('squares a traced outline back to its corners, as one finished change', () => {
    const { onUpdate } = open(pathCutout(tracedL()));
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.straighten' }));
    const slider = screen.getByRole('slider', { name: 'binDesigner.cutouts.outline.simplify' });
    for (let i = 0; i < 8; i++) fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(lastPatch(onUpdate).path).toHaveLength(6);
    expect(useDesignerStore.getState().transactionDepth).toBe(0);
  });

  it('puts the outline back exactly on reset', () => {
    const cutout = pathCutout(tracedL());
    const { onUpdate } = open(cutout);
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.curves' }));
    fireEvent.click(screen.getByText('binDesigner.cutouts.outline.reset'));
    expect(lastPatch(onUpdate).path).toEqual(cutout.path);
  });

  it('starts over from an edit made elsewhere', () => {
    const cutout = pathCutout(tracedL());
    const { rerender, onUpdate } = open(cutout);
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.curves' }));
    expect(screen.getByText('binDesigner.cutouts.outline.reset')).toBeInTheDocument();

    const moved = pathCutout(cutout.path?.map((p) => ({ ...p, x: p.x + 2 })) ?? []);
    rerender(<Harness cutout={moved} onUpdate={onUpdate} />);
    expect(screen.queryByText('binDesigner.cutouts.outline.reset')).toBeNull();
  });

  // Squared as drawn: a turned cutout's edges come out square to the bin, not
  // to its own stored frame.
  it('squares a turned cutout to the bin', () => {
    const turned = pathCutout(tracedL(), 3);
    const { onUpdate } = open(turned);
    fireEvent.click(screen.getByRole('switch', { name: 'binDesigner.cutouts.outline.straighten' }));
    const slider = screen.getByRole('slider', { name: 'binDesigner.cutouts.outline.simplify' });
    for (let i = 0; i < 8; i++) fireEvent.keyDown(slider, { key: 'ArrowRight' });

    const drawn = cutoutOutlineRing({ ...turned, ...lastPatch(onUpdate) }) ?? [];
    expect(drawn).toHaveLength(6);
    drawn.forEach(([x, y], i) => {
      const [nx, ny] = drawn[(i + 1) % drawn.length];
      expect(Math.min(Math.abs(x - nx), Math.abs(y - ny))).toBeLessThan(1e-6);
    });
  });
});
