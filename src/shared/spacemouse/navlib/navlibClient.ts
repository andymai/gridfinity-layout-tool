import { useSpaceMouseStore } from '../settingsStore';
import { spaceMouseBus } from '../spaceMouseBus';
import { buildCommandTree } from './commands';
import { loadNavlib } from './tdx';
import type { Navlib, NavlibClient, NavlibConstructor } from './tdxTypes';
import { commandForId } from './types';

/** Shown in the 3Dconnexion control panel as this app's profile. */
const APP_NAME = 'Gridfinity Layout Tool';

/** The driver's local NL-Proxy. Reachability here is our "driver present" signal. */
const NLPROXY_URL = 'https://127.51.68.120:8181/3dconnexion/nlproxy';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

let modulePromise: Promise<NavlibConstructor> | null = null;
let nav: Navlib | null = null;
let started = false;
let animating = false;
let rafId = 0;

function setConnection(
  ...args: Parameters<ReturnType<typeof useSpaceMouseStore.getState>['setConnection']>
) {
  useSpaceMouseStore.getState().setConnection(...args);
}

function loadModule(): Promise<NavlibConstructor> {
  if (!modulePromise) modulePromise = loadNavlib();
  return modulePromise;
}

/**
 * True when the local 3DxWare driver answers the NL-Proxy query for this origin.
 * A failure (no driver, untrusted cert, or an origin the proxy won't serve) is
 * the cue to fall back to WebHID, so this doubles as the origin/cert gate.
 */
export async function probeDriver(): Promise<boolean> {
  try {
    const res = await fetch(NLPROXY_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { port?: number };
    return typeof data.port === 'number';
  } catch {
    return false;
  }
}

function stopPump(): void {
  animating = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/**
 * While the puck is moving we are the frame-timing source: each rAF we hand the
 * driver a frame time, it computes the new camera and writes it back through
 * `setViewMatrix`. Mirrors the SDK's web_threejs sample.
 */
function pump(now: number): void {
  if (!animating || !nav) return;
  nav
    .update3dcontroller({ frame: { time: now } })
    .then(() => {
      if (animating) rafId = requestAnimationFrame(pump);
    })
    .catch(() => {
      stopPump();
      void nav?.update3dcontroller({ motion: false });
    });
}

function buildClient(): NavlibClient {
  const acc = () => spaceMouseBus.activeNavlib();

  return {
    onConnect() {
      // Bind to the window: the lib reports focus for the whole app and our bus
      // routes to the active canvas, so one controller drives whichever preview
      // is live (rather than a socket per canvas).
      nav?.create3dmouse(window, APP_NAME);
    },
    on3dmouseCreated() {
      if (!nav) return;
      setConnection('connected', '3Dconnexion driver');
      // Drive frame timing ourselves (see pump()).
      void nav.update3dcontroller({ frame: { timingSource: 1 } });
      void loadModule().then((ctor) => {
        if (nav) void nav.update3dcontroller({ commands: buildCommandTree(ctor) });
      });
    },
    onStartMotion() {
      if (!animating) {
        animating = true;
        rafId = requestAnimationFrame(pump);
      }
    },
    onStopMotion() {
      stopPump();
    },
    setTransaction(transaction) {
      // 0 marks the end of a frame's changes: render the result.
      if (transaction === 0) acc()?.invalidate();
    },
    setActiveCommand(id) {
      const command = commandForId(id);
      if (command) spaceMouseBus.dispatch(command);
    },

    // View reads (fall back to safe values when no canvas is active).
    getViewMatrix: () => acc()?.getViewMatrix() ?? IDENTITY,
    getPerspective: () => acc()?.getPerspective() ?? true,
    getViewExtents: () => acc()?.getViewExtents() ?? [-1, -1, -1, 1, 1, 1],
    getViewTarget: () => acc()?.getViewTarget() ?? [0, 0, 0],
    getViewRotatable: () => acc()?.getViewRotatable() ?? true,
    getFov: () => acc()?.getFov() ?? Math.PI / 4,
    getViewFrustum: () => acc()?.getViewFrustum() ?? [-1, 1, -1, 1, 0.1, 1000],
    getModelExtents: () => acc()?.getModelExtents() ?? null,
    getPivotPosition: () => acc()?.getPivotPosition() ?? null,
    getCoordinateSystem: () => acc()?.getCoordinateSystem() ?? IDENTITY,
    getFrontView: () => acc()?.getFrontView() ?? IDENTITY,
    getPointerPosition: () => acc()?.getPointerPosition() ?? null,
    getLookAt: () => acc()?.getLookAt() ?? null,
    // Minor properties the navigation models rarely need; safe constants.
    getUnitsToMeters: () => 1,
    getConstructionPlane: () => [0, 1, 0, 0],
    getFloorPlane: () => [0, 1, 0, 0],

    // View writes (the driver's computed camera).
    setViewMatrix(data) {
      acc()?.setViewMatrix(data);
    },
    setViewExtents(data) {
      acc()?.setViewExtents(data);
    },
    // Hit testing: the driver sets a ray, then reads getLookAt to pivot on the
    // surface under the cursor.
    setLookFrom(data) {
      acc()?.setLookFrom(data);
    },
    setLookDirection(data) {
      acc()?.setLookDirection(data);
    },
    setLookAperture(data) {
      acc()?.setLookAperture(data);
    },
    setSelectionOnly(data) {
      acc()?.setSelectionOnly(data);
    },
  };
}

/**
 * Connect to the driver. Assumes {@link probeDriver} already returned true.
 * `onDisconnect` lets the caller fall back to WebHID if the driver goes away.
 */
export async function startNavlib(opts: { onDisconnect: () => void }): Promise<void> {
  if (started) return;
  started = true;
  setConnection('connecting');
  try {
    const ctor = await loadModule();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stopNavlib() can flip `started` during the await
    if (!started) return; // stopped while loading
    const wrapped: NavlibClient = {
      ...buildClient(),
      onDisconnect() {
        // Reset our own state (so a later probe can reconnect the driver) before
        // handing off to the caller's WebHID fallback.
        stopPump();
        nav = null;
        started = false;
        setConnection('idle', null);
        opts.onDisconnect();
      },
    };
    nav = new ctor(wrapped);
    if (!nav.connect()) {
      setConnection('error');
      started = false;
      opts.onDisconnect();
    }
  } catch {
    setConnection('error');
    started = false;
    opts.onDisconnect();
  }
}

export function stopNavlib(): void {
  if (!started) return;
  started = false;
  stopPump();
  try {
    nav?.delete3dmouse();
  } catch {
    // Socket may already be gone.
  }
  nav = null;
}
