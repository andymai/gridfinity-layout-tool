import { isGlobalCommand, resolveButtonCommand } from './buttonMap';
import type { RawDeflection, RawRotation, RawTranslation, SpaceMouseCommand } from './types';

/** A per-canvas controller registered with the bus. */
export interface SpaceMouseController {
  id: string;
  /** Run a camera command against this canvas. */
  runCommand: (command: SpaceMouseCommand) => void;
  /** Wake this canvas so a demand-frameloop renders. */
  invalidate: () => void;
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
  private activeId: string | null = null;
  private globalHandler: ((command: SpaceMouseCommand) => void) | null = null;

  setGlobalHandler(handler: ((command: SpaceMouseCommand) => void) | null): void {
    this.globalHandler = handler;
  }

  register(controller: SpaceMouseController): () => void {
    this.controllers.set(controller.id, controller);
    if (this.activeId === null) this.activeId = controller.id;
    return () => this.unregister(controller.id);
  }

  private unregister(id: string): void {
    this.controllers.delete(id);
    if (this.activeId === id) {
      this.activeId = this.controllers.keys().next().value ?? null;
    }
  }

  setActive(id: string): void {
    if (this.controllers.has(id)) this.activeId = id;
  }

  isActive(id: string): boolean {
    return this.activeId === id;
  }

  setTranslation(translation: RawTranslation): void {
    this.translation = translation;
    this.wake();
  }

  setRotation(rotation: RawRotation): void {
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
    const command = resolveButtonCommand(buttonIndex);
    if (command) this.dispatch(command);
  }

  dispatch(command: SpaceMouseCommand): void {
    if (isGlobalCommand(command)) {
      this.globalHandler?.(command);
      return;
    }
    const active = this.activeId ? this.controllers.get(this.activeId) : null;
    active?.runCommand(command);
  }

  private wake(): void {
    const active = this.activeId ? this.controllers.get(this.activeId) : null;
    active?.invalidate();
  }

  /** Test-only: clear all registrations and state. */
  _resetForTests(): void {
    this.controllers.clear();
    this.activeId = null;
    this.globalHandler = null;
    this.translation = zeroTranslation();
    this.rotation = zeroRotation();
  }
}

export const spaceMouseBus = new SpaceMouseBus();
