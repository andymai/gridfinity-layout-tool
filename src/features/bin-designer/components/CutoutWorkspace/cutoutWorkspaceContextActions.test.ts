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
    onGroup: vi.fn(),
    groupContext: [],
    ungroupCutouts: vi.fn(),
    setGroupOp: vi.fn(),
    reorderCutouts: vi.fn(),
    flattenArray: vi.fn(),
    mergeIntoRepeat: vi.fn(),
    t: (k: string) => k,
    ...overrides,
  });
}

/** Three identical cutouts spaced on a regular pitch — a detectable pattern. */
function makeRow(): Cutout[] {
  return [0, 20, 40].map((x) => makeCutout({ id: `c${x}`, x, shape: 'rectangle' }));
}

const labels = (actions: ReturnType<typeof buildCutoutContextActions>) =>
  actions.map((a) => a.label);

describe('array context actions', () => {
  it('offers "Create array" for an arrayable single selection', () => {
    const actions = build(makeCutout());
    expect(labels(actions)).toContain('binDesigner.cutouts.repeat.create');
    expect(labels(actions)).not.toContain('binDesigner.cutouts.repeat.flatten');
  });

  it('create-array action sets a default array config', () => {
    const updateCutout = vi.fn();
    const actions = build(makeCutout(), { updateCutout });
    actions.find((a) => a.label === 'binDesigner.cutouts.repeat.create')?.onClick();
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
    expect(labels(actions)).toContain('binDesigner.cutouts.repeat.flatten');
    expect(labels(actions)).toContain('binDesigner.cutouts.repeat.remove');
    expect(labels(actions)).not.toContain('binDesigner.cutouts.repeat.create');
    actions.find((a) => a.label === 'binDesigner.cutouts.repeat.flatten')?.onClick();
    expect(flattenArray).toHaveBeenCalledWith('c1');
  });

  it('does not offer array actions for a path cutout', () => {
    const actions = build(makeCutout({ shape: 'path' }));
    expect(labels(actions)).not.toContain('binDesigner.cutouts.repeat.create');
  });
});

describe('group context actions', () => {
  const buildMulti = (cutouts: Cutout[], overrides: Record<string, unknown> = {}) =>
    build(cutouts[0], {
      cutouts,
      selection: new Set(cutouts.map((c) => c.id)),
      ...overrides,
    });

  it('offers Group for a loose multi-selection', () => {
    const onGroup = vi.fn();
    const actions = buildMulti([makeCutout({ id: 'a' }), makeCutout({ id: 'b' })], { onGroup });
    expect(labels(actions)).toContain('binDesigner.cutouts.group');
    expect(labels(actions)).not.toContain('binDesigner.cutouts.ungroup');
    actions.find((a) => a.label === 'binDesigner.cutouts.group')?.onClick();
    // No op: plain Group, which wraps at the level the editor is drilled into.
    expect(onGroup).toHaveBeenCalledWith(['a', 'b']);
  });

  it('forwards the chosen op through the same handler, so it keeps the level', () => {
    const onGroup = vi.fn();
    const actions = buildMulti([makeCutout({ id: 'a' }), makeCutout({ id: 'b' })], { onGroup });
    actions.find((a) => a.label === 'binDesigner.cutouts.pathfinder.subtract')?.onClick();
    expect(onGroup).toHaveBeenCalledWith(['a', 'b'], 'subtract');
  });

  it('offers Ungroup (not Group) when the selection is already one group', () => {
    const ungroupCutouts = vi.fn();
    const actions = buildMulti(
      [makeCutout({ id: 'a', groupId: 'g1' }), makeCutout({ id: 'b', groupId: 'g1' })],
      { ungroupCutouts }
    );
    expect(labels(actions)).not.toContain('binDesigner.cutouts.group');
    expect(labels(actions)).toContain('binDesigner.cutouts.ungroup');
    actions.find((a) => a.label === 'binDesigner.cutouts.ungroup')?.onClick();
    expect(ungroupCutouts).toHaveBeenCalledWith(['a', 'b']);
  });

  it('offers both when a loose shape is selected alongside a group', () => {
    const actions = buildMulti([
      makeCutout({ id: 'a', groupId: 'g1' }),
      makeCutout({ id: 'b', groupId: 'g1' }),
      makeCutout({ id: 'c' }),
    ]);
    expect(labels(actions)).toContain('binDesigner.cutouts.group');
    expect(labels(actions)).toContain('binDesigner.cutouts.ungroup');
  });

  it('keeps group actions off a single selection', () => {
    const actions = build(makeCutout({ groupId: 'g1' }));
    expect(labels(actions)).not.toContain('binDesigner.cutouts.group');
    expect(labels(actions)).not.toContain('binDesigner.cutouts.ungroup');
  });
});

describe('merge into repeat', () => {
  const buildFor = (cutouts: Cutout[], overrides: Record<string, unknown> = {}) =>
    build(cutouts[0], {
      cutouts,
      selection: new Set(cutouts.map((c) => c.id)),
      ...overrides,
    });

  it('offers the merge when the selection is a pattern', () => {
    expect(labels(buildFor(makeRow()))).toContain('binDesigner.cutouts.repeat.merge');
  });

  it('passes the detected pattern through, not just the ids', () => {
    const mergeIntoRepeat = vi.fn();
    const actions = buildFor(makeRow(), { mergeIntoRepeat });

    actions.find((a) => a.label === 'binDesigner.cutouts.repeat.merge')?.onClick();

    expect(mergeIntoRepeat).toHaveBeenCalledTimes(1);
    expect(mergeIntoRepeat.mock.calls[0][0]).toMatchObject({ mode: 'grid' });
  });

  it('stays hidden for a selection that is not a pattern', () => {
    const scattered = [
      makeCutout({ id: 'a', x: 0, y: 0, shape: 'rectangle' }),
      makeCutout({ id: 'b', x: 20, y: 0, shape: 'rectangle' }),
      makeCutout({ id: 'c', x: 37, y: 13, shape: 'rectangle' }),
    ];
    expect(labels(buildFor(scattered))).not.toContain('binDesigner.cutouts.repeat.merge');
  });

  it('stays hidden below the minimum selection', () => {
    const pair = makeRow().slice(0, 2);
    expect(labels(buildFor(pair))).not.toContain('binDesigner.cutouts.repeat.merge');
  });
});

describe('buildCutoutContextActions — centering', () => {
  it('offers all three centering entries for a selection', () => {
    expect(labels(build(makeCutout()))).toEqual(
      expect.arrayContaining([
        'binDesigner.cutouts.centerInBin',
        'binDesigner.cutouts.centerH',
        'binDesigner.cutouts.centerV',
      ])
    );
  });

  it('moves only the chosen axis, leaving the other where the user put it', () => {
    const updateCutout = vi.fn();
    const cutout = makeCutout({ x: 3, y: 7 });
    const actions = build(cutout, { updateCutout });

    const byLabel = (label: string) => {
      const action = actions.find((a) => a.label === label);
      if (!action) throw new Error(`no action ${label}`);
      return action;
    };

    byLabel('binDesigner.cutouts.centerH').onClick?.();
    expect(updateCutout).toHaveBeenLastCalledWith('c1', { x: 45, y: 7 });

    byLabel('binDesigner.cutouts.centerV').onClick?.();
    expect(updateCutout).toHaveBeenLastCalledWith('c1', { x: 3, y: 45 });

    byLabel('binDesigner.cutouts.centerInBin').onClick?.();
    expect(updateCutout).toHaveBeenLastCalledWith('c1', { x: 45, y: 45 });
  });
});
