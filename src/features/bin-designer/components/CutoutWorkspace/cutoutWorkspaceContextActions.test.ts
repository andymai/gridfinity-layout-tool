import { describe, it, expect, vi } from 'vitest';
import { buildCutoutContextActions } from './cutoutWorkspaceContextActions';
import type { Cutout } from '@/features/bin-designer/types';

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
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
  };
}

function build(cutout: Cutout, overrides: Record<string, unknown> = {}) {
  return buildCutoutContextActions({
    selection: new Set([cutout.id]),
    clipboard: [],
    cutouts: [cutout],
    binWidth: 100,
    binDepth: 100,
    copySelected: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    pasteFromClipboard: vi.fn(),
    selectAll: vi.fn(),
    updateCutout: vi.fn(),
    updateCutoutsBatch: vi.fn(),
    lockCutouts: vi.fn(),
    unlockCutouts: vi.fn(),
    groupCutouts: vi.fn(),
    setGroupOp: vi.fn(),
    reorderCutouts: vi.fn(),
    flattenArray: vi.fn(),
    t: (k: string) => k,
    ...overrides,
  });
}

const labels = (actions: ReturnType<typeof buildCutoutContextActions>) =>
  actions.map((a) => a.label);

describe('array context actions', () => {
  it('offers "Create array" for an arrayable single selection', () => {
    const actions = build(makeCutout());
    expect(labels(actions)).toContain('binDesigner.cutouts.array.create');
    expect(labels(actions)).not.toContain('binDesigner.cutouts.array.flatten');
  });

  it('create-array action sets a default array config', () => {
    const updateCutout = vi.fn();
    const actions = build(makeCutout(), { updateCutout });
    actions.find((a) => a.label === 'binDesigner.cutouts.array.create')?.onClick();
    expect(updateCutout).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ array: expect.objectContaining({ mode: 'grid' }) })
    );
  });

  it('offers Flatten + Remove (not Create) when an array exists', () => {
    const cfg = {
      mode: 'grid' as const,
      cols: 2,
      rows: 2,
      pitchX: 12,
      pitchY: 12,
      count: 4,
      radius: 20,
      startAngle: 0,
      rotateToCenter: true,
    };
    const flattenArray = vi.fn();
    const actions = build(makeCutout({ array: cfg }), { flattenArray });
    expect(labels(actions)).toContain('binDesigner.cutouts.array.flatten');
    expect(labels(actions)).toContain('binDesigner.cutouts.array.remove');
    expect(labels(actions)).not.toContain('binDesigner.cutouts.array.create');
    actions.find((a) => a.label === 'binDesigner.cutouts.array.flatten')?.onClick();
    expect(flattenArray).toHaveBeenCalledWith('c1');
  });

  it('does not offer array actions for a path cutout', () => {
    const actions = build(makeCutout({ shape: 'path' }));
    expect(labels(actions)).not.toContain('binDesigner.cutouts.array.create');
  });
});
