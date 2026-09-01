import { isGlobalCommand, resolveButtonCommand } from './buttonMap';
import type { NavlibViewAccessors } from './navlib/types';
import type { RawDeflection, RawRotation, RawTranslation, SpaceMouseCommand } from './types';

/** A per-canvas controller registered with the bus. */
export interface SpaceMouseController {
  id: string;
  /** Run a camera command against this canvas. */
  runCommand: (command: SpaceMouseCommand) => void;
  /** Wake this canvas so a demand-frameloop renders. */
  invalidate: () => void;
  /**
   * Hold the puck for as long as this canvas is mounted instead of waiting to be
   * hovered. Set by canvases inside a modal, which cover the canvas that would
   * otherwise keep moving unseen behind the overlay.
   */
  claim?: boolean;
  /**
   * Camera read/write surface for the driver-native (navlib) transport. Absent on
   * canvases that predate the accessor wiring; the WebHID transport ignores it.
   */
  navlib?: NavlibViewAccessors;
}

const zeroTranslation = (): RawTranslation => ({ x: 0, y: 0, z: 0 });
const zeroRotation = (): RawRotation => ({ pitch: 0, roll: 0, yaw: 0 });

/**
 * Fans a single SpaceMouse's input out to whichever canvas is currently active.
 * The device layer pushes raw axis values and button presses here; each mounted
 * canvas controller reads the latest deflection every frame. Motion goes to the
 * active canvas only; global commands (undo/redo) go to a registered handler.
 */
class SpaceMouseBus {
  private translation = zeroTranslation();
  private rotation = zeroRotation();
  private readonly controllers = new Map<string, SpaceMouseController>();
  private hoveredId: string | null = null;
  private readonly claims: string[] = [];
  private focused = true;
  private globalHandler: ((command: SpaceMouseCommand) => void) | null = null;

  setGlobalHandler(handler: ((command: SpaceMouseCommand) => void) | null): void {
    this.globalHandler = handler;
  }

  register(controller: SpaceMouseController): () => void {
    this.controllers.set(controller.id, controller);
    if (controller.claim) this.claims.push(controller.id);
    else if (this.hoveredId === null) this.hoveredId = controller.id;
    return () => this.unregister(controller.id);
  }

  private unregister(id: string): void {
    this.controllers.delete(id);
    const claim = this.claims.lastIndexOf(id);
    if (claim !== -1) this.claims.splice(claim, 1);
    if (this.hoveredId === id) this.hoveredId = null;
  }

  /**
   * Who the puck drives: the newest mounted modal claim, else the last canvas
   * hovered, else whichever registered first.
   */
  private active(): SpaceMouseController | null {
    for (let i = this.claims.length - 1; i >= 0; i--) {
      const claimed = this.controllers.get(this.claims[i]);
      if (claimed) return claimed;
    }
    const hovered = this.hoveredId ? this.controllers.get(this.hoveredId) : undefined;
    return hovered ?? this.controllers.values().next().value ?? null;
  }

  setActive(id: string): void {
    if (this.controllers.has(id)) this.hoveredId = id;
  }

  isActive(id: string): boolean {
    return this.active()?.id === id;
  }

  /** The active canvas's navlib accessors, for the driver-native transport. */
  activeNavlib(): NavlibViewAccessors | null {
    return this.active()?.navlib ?? null;
  }

  /**
   * Gate input on the app actually being frontmost. WebHID keeps delivering while
   * the window is backgrounded, so without this a puck driving another CAD app
   * silently drives whatever canvas is mounted here too (#4041).
   */
  setFocused(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    // Forget the deflection we last saw. A puck at rest reports nothing (the
    // device only emits on change), so a stale one would otherwise sit there and
    // replay the moment focus returns.
    if (!focused) this.resetDeflection();
  }

  setTranslation(translation: RawTranslation): void {
    if (!this.focused) return;
    this.translation = translation;
    this.wake();
  }

  setRotation(rotation: RawRotation): void {
    if (!this.focused) return;
    this.rotation = rotation;
    this.wake();
  }

  getRaw(): RawDeflection {
    return { translation: this.translation, rotation: this.rotation };
  }

  /** Zero the deflection, e.g. when a device disconnects mid-motion. */
  resetDeflection(): void {
    this.translation = zeroTranslation();
    this.rotation = zeroRotation();
    this.wake();
  }

  pressButton(buttonIndex: number): void {
    if (!this.focused) return;
    const command = resolveButtonCommand(buttonIndex);
    if (command) this.dispatch(command);
  }

  dispatch(command: SpaceMouseCommand): void {
    if (isGlobalCommand(command)) {
      this.globalHandler?.(command);
      return;
    }
    this.active()?.runCommand(command);
  }

  private wake(): void {
    this.active()?.invalidate();
  }

  /** Test-only: clear all registrations and state. */
  _resetForTests(): void {
    this.controllers.clear();
    this.claims.length = 0;
    this.hoveredId = null;
    this.focused = true;
    this.globalHandler = null;
    this.translation = zeroTranslation();
    this.rotation = zeroRotation();
  }
}

export const spaceMouseBus = new SpaceMouseBus();
