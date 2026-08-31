// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spaceMouseBus } from './spaceMouseBus';

vi.mock('spacemouse-webhid', () => ({
  PRODUCTS: {},
  getOpenedSpaceMice: vi.fn(async () => []),
  requestSpaceMice: vi.fn(async () => []),
  setupSpaceMouse: vi.fn(),
}));

vi.mock('./commands', () => ({ runGlobalCommand: vi.fn() }));

import { startSpaceMouse, stopSpaceMouse } from './deviceManager';

const FULL_DEFLECTION = { x: 350, y: 0, z: 0 };

function registerCanvas() {
  spaceMouseBus.register({ id: 'canvas', runCommand: vi.fn(), invalidate: vi.fn() });
}

let hasFocus: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.defineProperty(navigator, 'hid', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getDevices: vi.fn(async () => []),
      requestDevice: vi.fn(async () => []),
    },
  });
  spaceMouseBus._resetForTests();
  hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  stopSpaceMouse();
  vi.restoreAllMocks();
});

describe('deviceManager focus tracking', () => {
  it('drops puck input for a visible window that is not frontmost (#4041)', () => {
    registerCanvas();
    startSpaceMouse();
    hasFocus.mockReturnValue(false);
    window.dispatchEvent(new Event('blur'));
    // The reported case: the window is on screen, another CAD app just has the
    // keyboard. Gating on visibilityState instead would let the puck through.
    expect(document.visibilityState).toBe('visible');
    spaceMouseBus.setTranslation(FULL_DEFLECTION);
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('also tracks tab switches, which fire visibilitychange rather than blur', () => {
    registerCanvas();
    startSpaceMouse();
    hasFocus.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    spaceMouseBus.setTranslation(FULL_DEFLECTION);
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('takes input again when the window comes back', () => {
    registerCanvas();
    startSpaceMouse();
    hasFocus.mockReturnValue(false);
    window.dispatchEvent(new Event('blur'));
    hasFocus.mockReturnValue(true);
    window.dispatchEvent(new Event('focus'));
    spaceMouseBus.setTranslation(FULL_DEFLECTION);
    expect(spaceMouseBus.getRaw().translation).toEqual(FULL_DEFLECTION);
  });

  it('starts gated when the app loads in the background', () => {
    registerCanvas();
    hasFocus.mockReturnValue(false);
    startSpaceMouse();
    spaceMouseBus.setTranslation(FULL_DEFLECTION);
    expect(spaceMouseBus.getRaw().translation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('unsubscribes on stop, leaving the bus ungated', () => {
    registerCanvas();
    startSpaceMouse();
    stopSpaceMouse();
    hasFocus.mockReturnValue(false);
    window.dispatchEvent(new Event('blur'));
    spaceMouseBus.setTranslation(FULL_DEFLECTION);
    expect(spaceMouseBus.getRaw().translation).toEqual(FULL_DEFLECTION);
  });
});
