import { describe, it, expect, vi } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import type { InteractionMode } from '../useCutoutInteraction';
import { handleCutoutKeyDown } from './keyboardHandler';
import type { KeyboardHandlerContext } from './keyboardHandler';

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

type Ctx = KeyboardHandlerContext & {
  deleteSelected: ReturnType<typeof vi.fn>;
  deselectAll: ReturnType<typeof vi.fn>;
  selectAll: ReturnType<typeof vi.fn>;
  nudgeSelected: ReturnType<typeof vi.fn>;
  copySelected: ReturnType<typeof vi.fn>;
  pasteFromClipboard: ReturnType<typeof vi.fn>;
  duplicateSelected: ReturnType<typeof vi.fn>;
  makeRepeat: ReturnType<typeof vi.fn>;
  onUndo: ReturnType<typeof vi.fn>;
  onRedo: ReturnType<typeof vi.fn>;
  onGroup: ReturnType<typeof vi.fn>;
  onUngroup: ReturnType<typeof vi.fn>;
  onUpdate: ReturnType<typeof vi.fn>;
  onUpdateBatch: ReturnType<typeof vi.fn>;
  onLock: ReturnType<typeof vi.fn>;
  onUnlock: ReturnType<typeof vi.fn>;
  setPreview: ReturnType<typeof vi.fn>;
  clearActiveGuides: ReturnType<typeof vi.fn>;
  clearDrawingPreview: ReturnType<typeof vi.fn>;
  clearPathDrawingPreview: ReturnType<typeof vi.fn>;
  setPathDrawingPreview: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
  setSegmentHover: ReturnType<typeof vi.fn>;
  setSelection: ReturnType<typeof vi.fn>;
};

function makeCtx(overrides: Partial<KeyboardHandlerContext> = {}): Ctx {
  return {
    selection: new Set<string>(),
    cutouts: [],
    mode: { type: 'idle' },
    deleteSelected: vi.fn(),
    deselectAll: vi.fn(),
    selectAll: vi.fn(),
    nudgeSelected: vi.fn(),
    copySelected: vi.fn(),
    pasteFromClipboard: vi.fn(),
    duplicateSelected: vi.fn(),
    makeRepeat: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onGroup: vi.fn(),
    onUngroup: vi.fn(),
    onUpdate: vi.fn(),
    onUpdateBatch: vi.fn(),
    onLock: vi.fn(),
    onUnlock: vi.fn(),
    setPreview: vi.fn(),
    clearActiveGuides: vi.fn(),
    clearDrawingPreview: vi.fn(),
    clearPathDrawingPreview: vi.fn(),
    setPathDrawingPreview: vi.fn(),
    setMode: vi.fn(),
    setSegmentHover: vi.fn(),
    setSelection: vi.fn(),
    ...overrides,
  } as Ctx;
}

interface KeyOptions {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  tagName?: string;
}

function press(key: string, options: KeyOptions = {}): KeyboardEvent {
  const { tagName = 'DIV', ...flags } = options;
  const event = {
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...flags,
    target: { tagName },
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
  return event as unknown as KeyboardEvent;
}

describe('handleCutoutKeyDown — typing guard', () => {
  it.each(['INPUT', 'TEXTAREA'])('ignores every shortcut while typing in %s', (tagName) => {
    // Otherwise typing "r" in a label field rotates the selection.
    const ctx = makeCtx({ selection: new Set(['c1']), cutouts: [makeCutout()] });
    for (const key of ['Delete', 'r', 'Escape', 'ArrowLeft']) {
      handleCutoutKeyDown(press(key, { tagName }), ctx);
    }
    expect(ctx.deleteSelected).not.toHaveBeenCalled();
    expect(ctx.onUpdate).not.toHaveBeenCalled();
    expect(ctx.nudgeSelected).not.toHaveBeenCalled();
    expect(ctx.setMode).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — deletion and selection', () => {
  it.each(['Delete', 'Backspace'])('%s deletes the selection', (key) => {
    const ctx = makeCtx({ selection: new Set(['c1']) });
    const event = press(key);
    handleCutoutKeyDown(event, ctx);
    expect(ctx.deleteSelected).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it.each(['Delete', 'Backspace'])('leaves %s to the browser when nothing is selected', (key) => {
    // Backspace in particular has to stay available when it is not ours.
    const ctx = makeCtx();
    const event = press(key);
    handleCutoutKeyDown(event, ctx);
    expect(ctx.deleteSelected).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each([['metaKey' as const], ['ctrlKey' as const]])('%s+a selects all', (modifier) => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('a', { [modifier]: true }), ctx);
    expect(ctx.selectAll).toHaveBeenCalledTimes(1);
  });
});

describe('handleCutoutKeyDown — Escape', () => {
  it('clears the in-progress preview and guides', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('Escape'), ctx);
    expect(ctx.setPreview).toHaveBeenCalledWith(new Map());
    expect(ctx.clearActiveGuides).toHaveBeenCalled();
    expect(ctx.clearDrawingPreview).toHaveBeenCalled();
    expect(ctx.setMode).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('steps out one level and re-selects the containing group', () => {
    // Two-stage escape: drilled into g1 with one member selected, the first
    // press steps back out to the group rather than dropping the selection.
    const cutouts = [
      makeCutout({ id: 'a', groupId: 'g1' }),
      makeCutout({ id: 'b', groupId: 'g1' }),
    ];
    const exitGroup = vi.fn();
    const ctx = makeCtx({
      selection: new Set(['a']),
      cutouts,
      groupContext: ['g1'],
      exitGroup,
    });
    handleCutoutKeyDown(press('Escape'), ctx);
    expect(exitGroup).toHaveBeenCalled();
    expect(ctx.setSelection).toHaveBeenCalledWith(new Set(['a', 'b']));
    expect(ctx.deselectAll).not.toHaveBeenCalled();
  });

  it('steps out of a nested group to the subgroup, not all the way out', () => {
    const cutouts = [
      makeCutout({ id: 'a', groupId: 'gA', parentGroups: ['outer'] }),
      makeCutout({ id: 'b', groupId: 'gA', parentGroups: ['outer'] }),
      makeCutout({ id: 'c', groupId: 'gB', parentGroups: ['outer'] }),
    ];
    const exitGroup = vi.fn();
    const ctx = makeCtx({
      selection: new Set(['a']),
      cutouts,
      groupContext: ['outer', 'gA'],
      exitGroup,
    });
    handleCutoutKeyDown(press('Escape'), ctx);
    expect(exitGroup).toHaveBeenCalled();
    // Back inside `outer`, so the unit is gA — not the whole assembly.
    expect(ctx.setSelection).toHaveBeenCalledWith(new Set(['a', 'b']));
  });

  it('deselects when already at the top level', () => {
    // Nothing entered, so there is no level to step out to.
    const ctx = makeCtx({
      selection: new Set(['a']),
      cutouts: [makeCutout({ id: 'a', groupId: 'g1' })],
    });
    handleCutoutKeyDown(press('Escape'), ctx);
    expect(ctx.deselectAll).toHaveBeenCalled();
  });

  it('deselects an ungrouped selection outright', () => {
    const ctx = makeCtx({ selection: new Set(['a']), cutouts: [makeCutout({ id: 'a' })] });
    handleCutoutKeyDown(press('Escape'), ctx);
    expect(ctx.deselectAll).toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — undo and redo', () => {
  it('mod+z undoes and mod+shift+z redoes', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('z', { metaKey: true }), ctx);
    expect(ctx.onUndo).toHaveBeenCalledTimes(1);
    handleCutoutKeyDown(press('z', { metaKey: true, shiftKey: true }), ctx);
    expect(ctx.onRedo).toHaveBeenCalledTimes(1);
  });

  it('accepts the shifted Z and mod+y as redo', () => {
    // Shift changes the reported key, so both spellings have to be handled.
    const ctx = makeCtx();
    handleCutoutKeyDown(press('Z', { ctrlKey: true, shiftKey: true }), ctx);
    handleCutoutKeyDown(press('y', { ctrlKey: true }), ctx);
    expect(ctx.onRedo).toHaveBeenCalledTimes(2);
  });

  it('leaves a bare z alone', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('z'), ctx);
    expect(ctx.onUndo).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — clipboard', () => {
  it('maps mod+c, mod+v and mod+d to copy, paste and duplicate', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('c', { metaKey: true }), ctx);
    handleCutoutKeyDown(press('v', { metaKey: true }), ctx);
    handleCutoutKeyDown(press('d', { metaKey: true }), ctx);
    expect(ctx.copySelected).toHaveBeenCalledTimes(1);
    expect(ctx.pasteFromClipboard).toHaveBeenCalledTimes(1);
    expect(ctx.duplicateSelected).toHaveBeenCalledTimes(1);
  });

  it('maps mod+shift+d to make repeat, leaving plain duplicate alone', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('d', { metaKey: true, shiftKey: true }), ctx);
    expect(ctx.makeRepeat).toHaveBeenCalledTimes(1);
    expect(ctx.duplicateSelected).not.toHaveBeenCalled();
  });

  it('accepts the uppercase D the shift key actually produces', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('D', { metaKey: true, shiftKey: true }), ctx);
    expect(ctx.makeRepeat).toHaveBeenCalledTimes(1);
  });

  it('does not make a repeat on shift+d without the modifier', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('D', { shiftKey: true }), ctx);
    expect(ctx.makeRepeat).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — tool shortcuts', () => {
  it.each([
    ['c', { type: 'placing', shape: 'circle' }],
    ['g', { type: 'placing', shape: 'polygon' }],
    ['p', { type: 'placing', shape: 'path' }],
    ['s', { type: 'placing', shape: 'slot' }],
    ['t', { type: 'placing', shape: 'text' }],
    ['m', { type: 'ruler-ready' }],
    ['v', { type: 'idle' }],
  ])('bare %s switches tool', (key, expected) => {
    const ctx = makeCtx();
    const event = press(key);
    handleCutoutKeyDown(event, ctx);
    expect(ctx.setMode).toHaveBeenCalledWith(expected);
    // These are single letters that would otherwise reach a global shortcut.
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
  });

  it('bare r picks the rectangle tool only when nothing is selected', () => {
    const idle = makeCtx();
    handleCutoutKeyDown(press('r'), idle);
    expect(idle.setMode).toHaveBeenCalledWith({ type: 'placing', shape: 'rectangle' });

    const selected = makeCtx({ selection: new Set(['c1']), cutouts: [makeCutout()] });
    handleCutoutKeyDown(press('r'), selected);
    expect(selected.setMode).not.toHaveBeenCalled();
    expect(selected.onUpdate).toHaveBeenCalledWith('c1', { rotation: 90 });
  });
});

describe('handleCutoutKeyDown — rotate 90', () => {
  it('wraps past a full turn rather than accumulating', () => {
    const ctx = makeCtx({
      selection: new Set(['c1']),
      cutouts: [makeCutout({ rotation: 270 })],
    });
    handleCutoutKeyDown(press('r'), ctx);
    expect(ctx.onUpdate).toHaveBeenCalledWith('c1', { rotation: 0 });
  });

  it('refuses to rotate when any selected cutout is locked', () => {
    const ctx = makeCtx({
      selection: new Set(['a', 'b']),
      cutouts: [makeCutout({ id: 'a' }), makeCutout({ id: 'b', locked: true })],
    });
    handleCutoutKeyDown(press('r'), ctx);
    expect(ctx.onUpdate).not.toHaveBeenCalled();
    expect(ctx.onUpdateBatch).not.toHaveBeenCalled();
  });

  it('turns a multi-selection rigidly about its shared centre', () => {
    // Members must orbit the selection centre, not spin in place, or the
    // arrangement changes shape as it turns.
    const ctx = makeCtx({
      selection: new Set(['a', 'b']),
      cutouts: [
        makeCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10 }),
        makeCutout({ id: 'b', x: 30, y: 0, width: 10, depth: 10 }),
      ],
    });
    handleCutoutKeyDown(press('r'), ctx);

    const updates = ctx.onUpdateBatch.mock.calls[0][0] as ReadonlyMap<string, Partial<Cutout>>;
    expect(updates.size).toBe(2);
    for (const patch of updates.values()) expect(patch.rotation).toBe(90);
    // Centres started 30 apart on X; after a quarter turn they are 30 apart on Y.
    const a = updates.get('a');
    const b = updates.get('b');
    expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBeCloseTo(0);
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeCloseTo(30);
  });
});

describe('handleCutoutKeyDown — grouping', () => {
  it('groups two or more, and never one', () => {
    const two = makeCtx({ selection: new Set(['a', 'b']) });
    handleCutoutKeyDown(press('g', { metaKey: true }), two);
    expect(two.onGroup).toHaveBeenCalledWith(['a', 'b']);

    const one = makeCtx({ selection: new Set(['a']) });
    handleCutoutKeyDown(press('g', { metaKey: true }), one);
    expect(one.onGroup).not.toHaveBeenCalled();
  });

  it('ungroups on mod+shift+g in either reported spelling', () => {
    const lower = makeCtx({ selection: new Set(['a']) });
    handleCutoutKeyDown(press('g', { metaKey: true, shiftKey: true }), lower);
    expect(lower.onUngroup).toHaveBeenCalledWith(['a']);

    const upper = makeCtx({ selection: new Set(['a']) });
    handleCutoutKeyDown(press('G', { metaKey: true, shiftKey: true }), upper);
    expect(upper.onUngroup).toHaveBeenCalledWith(['a']);
  });
});

describe('handleCutoutKeyDown — nudge', () => {
  it.each([
    ['ArrowLeft', -0.5, 0],
    ['ArrowRight', 0.5, 0],
    ['ArrowUp', 0, 0.5],
    ['ArrowDown', 0, -0.5],
  ])('%s nudges by half a millimetre', (key, dx, dy) => {
    const ctx = makeCtx({ selection: new Set(['c1']) });
    handleCutoutKeyDown(press(key), ctx);
    expect(ctx.nudgeSelected).toHaveBeenCalledWith(dx, dy);
  });

  it('shift makes the nudge coarse', () => {
    const ctx = makeCtx({ selection: new Set(['c1']) });
    handleCutoutKeyDown(press('ArrowRight', { shiftKey: true }), ctx);
    expect(ctx.nudgeSelected).toHaveBeenCalledWith(5, 0);
  });

  it('does nothing with an empty selection', () => {
    const ctx = makeCtx();
    handleCutoutKeyDown(press('ArrowRight'), ctx);
    expect(ctx.nudgeSelected).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — flips', () => {
  it('requires shift, so CapsLock alone does not flip', () => {
    const ctx = makeCtx({ selection: new Set(['c1']), cutouts: [makeCutout()] });
    handleCutoutKeyDown(press('H'), ctx);
    handleCutoutKeyDown(press('V'), ctx);
    expect(ctx.onUpdate).not.toHaveBeenCalled();
    expect(ctx.onUpdateBatch).not.toHaveBeenCalled();
  });

  it('flips a single selection through onUpdate', () => {
    const ctx = makeCtx({ selection: new Set(['c1']), cutouts: [makeCutout()] });
    handleCutoutKeyDown(press('H', { shiftKey: true }), ctx);
    expect(ctx.onUpdate).toHaveBeenCalled();
  });

  it('refuses to flip when any selected cutout is locked', () => {
    const ctx = makeCtx({
      selection: new Set(['a']),
      cutouts: [makeCutout({ id: 'a', locked: true })],
    });
    handleCutoutKeyDown(press('V', { shiftKey: true }), ctx);
    expect(ctx.onUpdate).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — lock toggle', () => {
  it('locks a mixed selection rather than unlocking it', () => {
    // Otherwise ctrl+L on a mixed selection would silently unlock the one
    // the user had deliberately locked.
    const ctx = makeCtx({
      selection: new Set(['a', 'b']),
      cutouts: [makeCutout({ id: 'a', locked: true }), makeCutout({ id: 'b' })],
    });
    handleCutoutKeyDown(press('l', { metaKey: true }), ctx);
    expect(ctx.onLock).toHaveBeenCalledWith(['a', 'b']);
    expect(ctx.onUnlock).not.toHaveBeenCalled();
  });

  it('unlocks only when every selected cutout is locked', () => {
    const ctx = makeCtx({
      selection: new Set(['a', 'b']),
      cutouts: [makeCutout({ id: 'a', locked: true }), makeCutout({ id: 'b', locked: true })],
    });
    handleCutoutKeyDown(press('l', { metaKey: true }), ctx);
    expect(ctx.onUnlock).toHaveBeenCalledWith(['a', 'b']);
  });
});

describe('handleCutoutKeyDown — Tab cycling', () => {
  const three = [makeCutout({ id: 'a' }), makeCutout({ id: 'b' }), makeCutout({ id: 'c' })];

  it('steps forward and wraps at the end', () => {
    const ctx = makeCtx({ selection: new Set(['c']), cutouts: three });
    handleCutoutKeyDown(press('Tab'), ctx);
    expect(ctx.setSelection).toHaveBeenCalledWith(new Set(['a']));
  });

  it('steps backward and wraps at the start', () => {
    const ctx = makeCtx({ selection: new Set(['a']), cutouts: three });
    handleCutoutKeyDown(press('Tab', { shiftKey: true }), ctx);
    expect(ctx.setSelection).toHaveBeenCalledWith(new Set(['c']));
  });

  it('starts at the first cutout when nothing is selected', () => {
    const ctx = makeCtx({ cutouts: three });
    handleCutoutKeyDown(press('Tab'), ctx);
    expect(ctx.setSelection).toHaveBeenCalledWith(new Set(['a']));
  });

  it('leaves Tab to the browser when there is nothing to cycle', () => {
    const ctx = makeCtx();
    const event = press('Tab');
    handleCutoutKeyDown(event, ctx);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(ctx.setSelection).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — path drawing mode', () => {
  const drawing = (points: Array<{ x: number; y: number }>): InteractionMode =>
    ({ type: 'path-drawing', points }) as unknown as InteractionMode;

  it('mod+z pops the last point and keeps drawing', () => {
    const ctx = makeCtx({
      mode: drawing([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 9, y: 9 },
      ]),
    });
    handleCutoutKeyDown(press('z', { metaKey: true }), ctx);

    expect(ctx.clearPathDrawingPreview).not.toHaveBeenCalled();
    expect(ctx.setPathDrawingPreview).toHaveBeenCalledWith({
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      // The cursor follows the point that is now last, so the rubber band
      // starts where the line actually ends.
      cursorX: 5,
      cursorY: 5,
      canClose: false,
    });
  });

  it('mod+z on the last remaining point cancels the drawing', () => {
    const ctx = makeCtx({ mode: drawing([{ x: 0, y: 0 }]) });
    handleCutoutKeyDown(press('z', { metaKey: true }), ctx);
    expect(ctx.clearPathDrawingPreview).toHaveBeenCalled();
    expect(ctx.setMode).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('Escape abandons the drawing', () => {
    const ctx = makeCtx({
      mode: drawing([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    });
    handleCutoutKeyDown(press('Escape'), ctx);
    expect(ctx.clearPathDrawingPreview).toHaveBeenCalled();
    expect(ctx.setMode).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('swallows the shortcuts that would apply outside drawing', () => {
    // Deleting the selection mid-path would act on something the user cannot
    // even see while the pen is down.
    const ctx = makeCtx({ selection: new Set(['c1']), mode: drawing([{ x: 0, y: 0 }]) });
    handleCutoutKeyDown(press('Delete'), ctx);
    handleCutoutKeyDown(press('r'), ctx);
    expect(ctx.deleteSelected).not.toHaveBeenCalled();
    expect(ctx.onUpdate).not.toHaveBeenCalled();
  });
});

describe('handleCutoutKeyDown — vertex editing mode', () => {
  const editing = { type: 'vertex-editing', cutoutId: 'c1' } as unknown as InteractionMode;

  it('leaves vertex editing before undoing, so the overlay cannot go stale', () => {
    const ctx = makeCtx({ mode: editing, cutouts: [makeCutout()] });
    handleCutoutKeyDown(press('z', { metaKey: true }), ctx);
    expect(ctx.setMode).toHaveBeenCalledWith({ type: 'idle' });
    expect(ctx.onUndo).toHaveBeenCalledTimes(1);
  });

  it('treats mod+y and mod+shift+z as redo', () => {
    const ctx = makeCtx({ mode: editing, cutouts: [makeCutout()] });
    handleCutoutKeyDown(press('y', { ctrlKey: true }), ctx);
    handleCutoutKeyDown(press('z', { ctrlKey: true, shiftKey: true }), ctx);
    expect(ctx.onRedo).toHaveBeenCalledTimes(2);
    expect(ctx.onUndo).not.toHaveBeenCalled();
  });

  it('does nothing when the edited cutout has gone', () => {
    const ctx = makeCtx({ mode: editing, cutouts: [] });
    expect(() => handleCutoutKeyDown(press('Delete'), ctx)).not.toThrow();
    expect(ctx.deleteSelected).not.toHaveBeenCalled();
  });
});
