import { useSpaceMouseStore } from '../settingsStore';
import { spaceMouseBus } from '../spaceMouseBus';
import { buildCommandTree } from './commands';
import { loadNavlib } from './tdx';
import type { Navlib, NavlibClient, NavlibConstructor } from './tdxTypes';
import { commandForId, type NavlibViewAccessors } from './types';

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
      void nav
        ?.update3dcontroller({ motion: false })
        .catch((e: unknown) => reportOnce('motion', e));
    });
}

/**
 * The 3Dconnexion library calls every accessor straight from its WebSocket
 * message handler with no try/catch, so an exception here is never answered on
 * the wire and the driver blocks on its 2 s reply timeout with the puck dead.
 * Nothing crossing this boundary may throw.
 */
const reported = new Set<string>();
const warned = new Set<string>();

interface ErrorModule {
  captureException: (error: Error, context?: Record<string, unknown>) => void;
}
let loadingErrorModule: Promise<ErrorModule> | null = null;

/**
 * Loaded on demand: the error module pulls the layout and labs stores into its
 * graph, which must not become a static dependency of the device layer. One
 * in-flight import is shared so a burst of failures does not race the loader.
 */
function loadErrorModule(): Promise<ErrorModule> {
  loadingErrorModule ??= import('@/shared/analytics/posthog/eventsErrors').finally(() => {
    loadingErrorModule = null;
  });
  return loadingErrorModule;
}

function reportOnce(property: string, error: unknown): void {
  if (reported.has(property)) return;
  reported.add(property);
  const err = error instanceof Error ? error : new Error(String(error));
  if (!warned.has(property)) {
    warned.add(property);
    console.warn(`[spacemouse] ${property} failed at the navlib boundary`, err);
  }
  void loadErrorModule()
    .then((m) => m.captureException(err, { boundary: 'spacemouse-navlib', property }))
    // The chunk did not load; let the next failure try to report again.
    .catch(() => reported.delete(property));
}

/** The driver may write into an array it is handed, so it never gets ours. */
function freshCopy<R>(fallback: R): R {
  return Array.isArray(fallback) ? (fallback.slice() as R) : fallback;
}

export function guardRead<R>(property: string, fallback: R, read: () => R | undefined): () => R {
  return () => {
    try {
      return read() ?? freshCopy(fallback);
    } catch (error) {
      reportOnce(property, error);
      return freshCopy(fallback);
    }
  };
}

export function guardCall<A extends unknown[]>(
  property: string,
  fn: (...args: A) => void
): (...args: A) => void {
  return (...args) => {
    try {
      fn(...args);
    } catch (error) {
      reportOnce(property, error);
    }
  };
}

/** Exported so a test can prove every entry is guarded; `acc` resolves the active canvas. */
export function buildClient(acc: () => NavlibViewAccessors | null): NavlibClient {
  return {
    onConnect: guardCall('connect', () => {
      // Bind to the window: the lib reports focus for the whole app and our bus
      // routes to the active canvas, so one controller drives whichever preview
      // is live (rather than a socket per canvas).
      nav?.create3dmouse(window, APP_NAME);
    }),
    on3dmouseCreated: guardCall('3dmouseCreated', () => {
      if (!nav) return;
      setConnection('connected', '3Dconnexion driver');
      // Drive frame timing ourselves (see pump()).
      void nav
        .update3dcontroller({ frame: { timingSource: 1 } })
        .catch((e: unknown) => reportOnce('frame.timingSource', e));
      void loadModule()
        .then((ctor) => nav?.update3dcontroller({ commands: buildCommandTree(ctor) }))
        .catch((e: unknown) => reportOnce('commands.tree', e));
    }),
    onStartMotion: guardCall('motion.start', () => {
      if (!animating) {
        animating = true;
        rafId = requestAnimationFrame(pump);
      }
    }),
    onStopMotion: guardCall('motion.stop', stopPump),
    // 0 marks the end of a frame's changes: render the result.
    setTransaction: guardCall('transaction', (transaction: number) => {
      if (transaction === 0) acc()?.invalidate();
    }),
    setActiveCommand: guardCall('commands.activeCommand', (id: string) => {
      const command = commandForId(id);
      if (command) spaceMouseBus.dispatch(command);
    }),

    getViewMatrix: guardRead('view.affine', IDENTITY, () => acc()?.getViewMatrix()),
    getPerspective: guardRead('view.perspective', true, () => acc()?.getPerspective()),
    getViewExtents: guardRead('view.extents', [-1, -1, -1, 1, 1, 1], () => acc()?.getViewExtents()),
    getViewTarget: guardRead('view.target', [0, 0, 0], () => acc()?.getViewTarget()),
    getViewRotatable: guardRead('view.rotatable', true, () => acc()?.getViewRotatable()),
    getFov: guardRead('view.fov', Math.PI / 4, () => acc()?.getFov()),
    getViewFrustum: guardRead('view.frustum', [-1, 1, -1, 1, 0.1, 1000], () =>
      acc()?.getViewFrustum()
    ),
    getModelExtents: guardRead('model.extents', null, () => acc()?.getModelExtents()),
    getPivotPosition: guardRead('pivot.position', null, () => acc()?.getPivotPosition()),
    getCoordinateSystem: guardRead('coordinateSystem', IDENTITY, () =>
      acc()?.getCoordinateSystem()
    ),
    getFrontView: guardRead('views.front', IDENTITY, () => acc()?.getFrontView()),
    getConstructionPlane: guardRead('view.constructionPlane', [0, 0, 1, 0], () =>
      acc()?.getConstructionPlane()
    ),
    getFloorPlane: guardRead('model.floorPlane', [0, 0, 1, 0], () => acc()?.getFloorPlane()),
    getPointerPosition: guardRead('pointer.position', null, () => acc()?.getPointerPosition()),
    getLookAt: guardRead('hit.lookat', null, () => acc()?.getLookAt()),
    getUnitsToMeters: () => 1,

    setViewMatrix: guardCall('view.affine', (data: number[]) => acc()?.setViewMatrix(data)),
    setViewExtents: guardCall('view.extents', (data: number[]) => acc()?.setViewExtents(data)),
    setLookFrom: guardCall('hit.lookfrom', (data: number[]) => acc()?.setLookFrom(data)),
    setLookDirection: guardCall('hit.direction', (data: number[]) => acc()?.setLookDirection(data)),
    setLookAperture: guardCall('hit.aperture', (data: number) => acc()?.setLookAperture(data)),
    setSelectionOnly: guardCall('hit.selectionOnly', (data: boolean) =>
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
      ...buildClient(() => spaceMouseBus.activeNavlib()),
      onDisconnect: guardCall('disconnect', () => {
        // Ignore a disconnect from a superseded connection (stop/start race).
        if (nav !== instance) return;
        // Reset our own state (so a later probe can reconnect the driver) before
        // handing off to the caller's WebHID fallback.
        stopPump();
        nav = null;
        started = false;
        setConnection('idle', null);
        opts.onDisconnect();
      }),
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
  reported.clear();
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
