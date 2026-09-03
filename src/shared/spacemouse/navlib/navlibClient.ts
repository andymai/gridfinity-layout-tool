import { captureException } from '@/shared/analytics/posthog/eventsErrors';
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
// Bumped on every start/stop so a continuation after the async module load can
// tell it was superseded by a stop or restart.
let navGeneration = 0;
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

/**
 * The 3Dconnexion library calls every accessor straight from its WebSocket
 * message handler with no try/catch, so an exception here is never answered on
 * the wire and the driver blocks on its 2 s reply timeout with the puck dead.
 * Nothing crossing this boundary may throw: a failing accessor is reported once
 * and the driver gets the value it would see with no canvas.
 */
const reported = new Set<string>();

function reportOnce(property: string, error: unknown): void {
  if (reported.has(property)) return;
  reported.add(property);
  const err = error instanceof Error ? error : new Error(String(error));
  console.warn(
    `[spacemouse] ${property} accessor threw; answering the driver with a fallback`,
    err
  );
  captureException(err, { boundary: 'spacemouse-navlib', property });
}

export function guardRead<R>(
  property: string,
  read: () => R | null | undefined,
  fallback: () => R
): () => R {
  return () => {
    try {
      return read() ?? fallback();
    } catch (error) {
      reportOnce(property, error);
      return fallback();
    }
  };
}

export function guardWrite<A>(property: string, write: (data: A) => void): (data: A) => void {
  return (data) => {
    try {
      write(data);
    } catch (error) {
      reportOnce(property, error);
    }
  };
}

function buildClient(): NavlibClient {
  const acc = () => spaceMouseBus.activeNavlib();
  const point = (): number[] | null => null;

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
    // 0 marks the end of a frame's changes: render the result.
    setTransaction: guardWrite<number>('transaction', (transaction) => {
      if (transaction === 0) acc()?.invalidate();
    }),
    setActiveCommand: guardWrite<string>('commands.activeCommand', (id) => {
      const command = commandForId(id);
      if (command) spaceMouseBus.dispatch(command);
    }),

    // View reads (fall back to safe values when no canvas is active). Fallbacks
    // return fresh arrays so a mutating driver can't corrupt a shared constant.
    getViewMatrix: guardRead(
      'view.affine',
      () => acc()?.getViewMatrix(),
      () => IDENTITY.slice()
    ),
    getPerspective: guardRead(
      'view.perspective',
      () => acc()?.getPerspective(),
      () => true
    ),
    getViewExtents: guardRead(
      'view.extents',
      () => acc()?.getViewExtents(),
      () => [-1, -1, -1, 1, 1, 1]
    ),
    getViewTarget: guardRead(
      'view.target',
      () => acc()?.getViewTarget(),
      () => [0, 0, 0]
    ),
    getViewRotatable: guardRead(
      'view.rotatable',
      () => acc()?.getViewRotatable(),
      () => true
    ),
    getFov: guardRead(
      'view.fov',
      () => acc()?.getFov(),
      () => Math.PI / 4
    ),
    getViewFrustum: guardRead(
      'view.frustum',
      () => acc()?.getViewFrustum(),
      () => [-1, 1, -1, 1, 0.1, 1000]
    ),
    getModelExtents: guardRead('model.extents', () => acc()?.getModelExtents(), point),
    getPivotPosition: guardRead('pivot.position', () => acc()?.getPivotPosition(), point),
    getCoordinateSystem: guardRead(
      'coordinateSystem',
      () => acc()?.getCoordinateSystem(),
      () => IDENTITY.slice()
    ),
    getFrontView: guardRead(
      'views.front',
      () => acc()?.getFrontView(),
      () => IDENTITY.slice()
    ),
    getConstructionPlane: guardRead(
      'view.constructionPlane',
      () => acc()?.getConstructionPlane(),
      () => [0, 0, 1, 0]
    ),
    getFloorPlane: guardRead(
      'model.floorPlane',
      () => acc()?.getFloorPlane(),
      () => [0, 0, 1, 0]
    ),
    getPointerPosition: guardRead('pointer.position', () => acc()?.getPointerPosition(), point),
    getLookAt: guardRead('hit.lookat', () => acc()?.getLookAt(), point),
    getUnitsToMeters: () => 1,

    // View writes (the driver's computed camera).
    setViewMatrix: guardWrite<number[]>('view.affine', (data) => acc()?.setViewMatrix(data)),
    setViewExtents: guardWrite<number[]>('view.extents', (data) => acc()?.setViewExtents(data)),
    // Hit testing: the driver sets a ray, then reads getLookAt to pivot on the
    // surface under the cursor.
    setLookFrom: guardWrite<number[]>('hit.lookfrom', (data) => acc()?.setLookFrom(data)),
    setLookDirection: guardWrite<number[]>('hit.direction', (data) =>
      acc()?.setLookDirection(data)
    ),
    setLookAperture: guardWrite<number>('hit.aperture', (data) => acc()?.setLookAperture(data)),
    setSelectionOnly: guardWrite<boolean>('hit.selectionOnly', (data) =>
      acc()?.setSelectionOnly(data)
    ),
  };
}

/**
 * Connect to the driver. Assumes {@link probeDriver} already returned true.
 * `onDisconnect` lets the caller fall back to WebHID if the driver goes away.
 */
export async function startNavlib(opts: { onDisconnect: () => void }): Promise<void> {
  if (started) return;
  started = true;
  const gen = ++navGeneration;
  setConnection('connecting');
  try {
    const ctor = await loadModule();
    if (gen !== navGeneration) return; // stopped or restarted while loading
    let instance: Navlib | null = null;
    const wrapped: NavlibClient = {
      ...buildClient(),
      onDisconnect() {
        // Ignore a disconnect from a superseded connection (stop/start race).
        if (nav !== instance) return;
        // Reset our own state (so a later probe can reconnect the driver) before
        // handing off to the caller's WebHID fallback.
        stopPump();
        nav = null;
        started = false;
        setConnection('idle', null);
        opts.onDisconnect();
      },
    };
    instance = new ctor(wrapped);
    nav = instance;
    if (!nav.connect()) {
      setConnection('error');
      started = false;
      nav = null;
      opts.onDisconnect();
    }
  } catch {
    if (gen !== navGeneration) return; // superseded start; don't clobber the live session
    setConnection('error');
    started = false;
    nav = null;
    opts.onDisconnect();
  }
}

/** Idempotent: safe to call when navlib is already stopped or was never started. */
export function stopNavlib(): void {
  if (!nav && !started) return;
  started = false;
  navGeneration++; // supersede an in-flight module load
  stopPump();
  // Null `nav` before delete3dmouse so its close→onDisconnect sees a superseded
  // instance and doesn't re-enter the fallback.
  const instance = nav;
  nav = null;
  try {
    instance?.delete3dmouse();
  } catch {
    // Socket may already be gone.
  }
}
