import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type * as OutlineCleanup from '@/shared/outlineCleanup';
import { prepareScanCutouts } from './scanOutline';

const fit = vi.hoisted(() => ({
  result: null as null | { path: PathPoint[]; holes: PathPoint[][] },
}));

vi.mock('@/shared/outlineCleanup', async (importOriginal) => {
  const real = await importOriginal<typeof OutlineCleanup>();
  return { ...real, cleanOutline: () => fit.result };
});

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

const square = (x0: number, y0: number, size: number): PathPoint[] => [
  corner(x0, y0),
  corner(x0 + size, y0),
  corner(x0 + size, y0 + size),
  corner(x0, y0 + size),
];

/** A 40 mm ring tool with a 20 mm island in its middle. */
function ringTool(): Cutout {
  return {
    id: 'ring',
    shape: 'path',
    x: 0,
    y: 0,
    width: 40,
    depth: 40,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: square(0, 0, 40),
    holes: [square(10, 10, 20)],
  };
}

describe('prepareScanCutouts when the fit would change how the tool cuts', () => {
  beforeEach(() => {
    fit.result = null;
  });

  it('keeps the trace when the fit drops an island', () => {
    fit.result = { path: square(0, 0, 40), holes: [] };
    expect(prepareScanCutouts([ringTool()])).toEqual([ringTool()]);
  });

  it('keeps the trace when the fit closes the gap round an island', () => {
    // The island reaches past the fitted outline: the wall between them is gone.
    fit.result = { path: square(0, 0, 40), holes: [square(30, 10, 20)] };
    expect(prepareScanCutouts([ringTool()])).toEqual([ringTool()]);
  });

  it('keeps the trace when the fitted outline crosses itself', () => {
    const bowTie = [corner(0, 0), corner(40, 40), corner(40, 0), corner(0, 40)];
    fit.result = { path: bowTie, holes: [square(10, 10, 20)] };
    expect(prepareScanCutouts([ringTool()])).toEqual([ringTool()]);
  });

  it('takes a fit that cuts the same way', () => {
    fit.result = { path: square(0, 0, 40), holes: [square(11, 11, 18)] };
    const [tool] = prepareScanCutouts([ringTool()]);
    expect(tool.holes?.[0]).toEqual(square(11, 11, 18));
  });
});
