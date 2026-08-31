import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spaceMouseBus } from './spaceMouseBus';
import type { SpaceMouseCommand } from './types';

function makeController(id: string) {
  return {
    id,
    runCommand: vi.fn<(command: SpaceMouseCommand) => void>(),
    invalidate: vi.fn(),
  };
}

beforeEach(() => {
  spaceMouseBus._resetForTests();
});

describe('spaceMouseBus registration', () => {
  it('makes the first registered controller active', () => {
    const a = makeController('a');
    const b = makeController('b');
    spaceMouseBus.register(a);
    spaceMouseBus.register(b);
    expect(spaceMouseBus.isActive('a')).toBe(true);
    expect(spaceMouseBus.isActive('b')).toBe(false);
  });

  it('lets a canvas claim active focus', () => {
    spaceMouseBus.register(makeController('a'));
    spaceMouseBus.register(makeController('b'));
    spaceMouseBus.setActive('b');
    expect(spaceMouseBus.isActive('b')).toBe(true);
  });

  it('reassigns active when the active controller unregisters', () => {
    const a = makeController('a');
    const unregisterA = spaceMouseBus.register(a);
    spaceMouseBus.register(makeController('b'));
    expect(spaceMouseBus.isActive('a')).toBe(true);
    unregisterA();
    expect(spaceMouseBus.isActive('a')).toBe(false);
    expect(spaceMouseBus.isActive('b')).toBe(true);
  });
});

describe('spaceMouseBus modal claims', () => {
  it('hands the puck to a modal canvas the moment it mounts', () => {
    spaceMouseBus.register(makeController('page'));
    const unregisterModal = spaceMouseBus.register({ ...makeController('modal'), claim: true });
    expect(spaceMouseBus.isActive('modal')).toBe(true);
    expect(spaceMouseBus.isActive('page')).toBe(false);
    unregisterModal();
    expect(spaceMouseBus.isActive('page')).toBe(true);
  });

  it('outranks a hover claim, since the modal covers what was hovered', () => {
    spaceMouseBus.register(makeController('page'));
    spaceMouseBus.register({ ...makeController('modal'), claim: true });
    spaceMouseBus.setActive('page');
    expect(spaceMouseBus.isActive('modal')).toBe(true);
  });

  it('falls back to the outer modal when a nested one closes', () => {
    spaceMouseBus.register(makeController('page'));
    spaceMouseBus.register({ ...makeController('outer'), claim: true });
    const unregisterInner = spaceMouseBus.register({ ...makeController('inner'), claim: true });
    expect(spaceMouseBus.isActive('inner')).toBe(true);
    unregisterInner();
    expect(spaceMouseBus.isActive('outer')).toBe(true);
  });

  it('routes motion and commands to the modal canvas', () => {
    const page = makeController('page');
    const modal = makeController('modal');
    spaceMouseBus.register(page);
    spaceMouseBus.register({ ...modal, claim: true });
    spaceMouseBus.setTranslation({ x: 10, y: 0, z: 0 });
    spaceMouseBus.pressButton(0); // fit
    expect(modal.invalidate).toHaveBeenCalled();
    expect(modal.runCommand).toHaveBeenCalledWith('fit');
    expect(page.invalidate).not.toHaveBeenCalled();
    expect(page.runCommand).not.toHaveBeenCalled();
  });
});

describe('spaceMouseBus focus gating', () => {
  it('ignores motion and buttons while the app is not frontmost (#4041)', () => {
    const a = makeController('a');
    spaceMouseBus.register(a);
    const handler = vi.fn();
    spaceMouseBus.setGlobalHandler(handler);
    spaceMouseBus.setFocused(false);
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 });
    spaceMouseBus.setRotation({ pitch: 350, roll: 0, yaw: 0 });
    spaceMouseBus.pressButton(0); // fit
    spaceMouseBus.pressButton(6); // undo
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 0, y: 0, z: 0 });
    expect(spaceMouseBus.getRaw().rotation).toEqual({ pitch: 0, roll: 0, yaw: 0 });
    expect(a.runCommand).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('drops the deflection it was holding when focus is lost', () => {
    spaceMouseBus.register(makeController('a'));
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 });
    spaceMouseBus.setFocused(false);
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('accepts input again once focus returns', () => {
    spaceMouseBus.register(makeController('a'));
    spaceMouseBus.setFocused(false);
    spaceMouseBus.setFocused(true);
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 });
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 350, y: 0, z: 0 });
  });
});

describe('spaceMouseBus motion', () => {
  it('stores the latest raw deflection and wakes the active canvas', () => {
    const a = makeController('a');
    spaceMouseBus.register(a);
    spaceMouseBus.setTranslation({ x: 10, y: 0, z: -5 });
    spaceMouseBus.setRotation({ pitch: 1, roll: 0, yaw: 2 });
    expect(spaceMouseBus.getRaw()).toEqual({
      translation: { x: 10, y: 0, z: -5 },
      rotation: { pitch: 1, roll: 0, yaw: 2 },
    });
    expect(a.invalidate).toHaveBeenCalled();
  });

  it('zeroes deflection on reset', () => {
    spaceMouseBus.register(makeController('a'));
    spaceMouseBus.setTranslation({ x: 10, y: 0, z: 0 });
    spaceMouseBus.resetDeflection();
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('spaceMouseBus command routing', () => {
  it('routes camera commands to the active controller only', () => {
    const a = makeController('a');
    const b = makeController('b');
    spaceMouseBus.register(a);
    spaceMouseBus.register(b);
    spaceMouseBus.setActive('b');
    spaceMouseBus.pressButton(0); // fit
    expect(b.runCommand).toHaveBeenCalledWith('fit');
    expect(a.runCommand).not.toHaveBeenCalled();
  });

  it('routes global commands to the global handler, not a canvas', () => {
    const a = makeController('a');
    spaceMouseBus.register(a);
    const handler = vi.fn();
    spaceMouseBus.setGlobalHandler(handler);
    spaceMouseBus.pressButton(6); // undo
    expect(handler).toHaveBeenCalledWith('undo');
    expect(a.runCommand).not.toHaveBeenCalled();
  });

  it('ignores unmapped buttons', () => {
    const a = makeController('a');
    spaceMouseBus.register(a);
    const handler = vi.fn();
    spaceMouseBus.setGlobalHandler(handler);
    spaceMouseBus.pressButton(99);
    expect(a.runCommand).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
