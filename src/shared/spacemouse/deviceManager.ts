import type * as SpaceMouseWebHid from 'spacemouse-webhid';
import { probeDriver, startNavlib, stopNavlib } from './navlib/navlibClient';
import { useSpaceMouseStore } from './settingsStore';
import { spaceMouseBus } from './spaceMouseBus';
import type { SpaceMouseTransport } from './types';

type WebHidModule = typeof SpaceMouseWebHid;
type SpaceMouseDevice = Awaited<ReturnType<WebHidModule['setupSpaceMouse']>>;

let modulePromise: Promise<WebHidModule> | null = null;
let device: SpaceMouseDevice | null = null;
let started = false;
let activeTransport: SpaceMouseTransport | null = null;

function setConnection(
  ...args: Parameters<ReturnType<typeof useSpaceMouseStore.getState>['setConnection']>
) {
  useSpaceMouseStore.getState().setConnection(...args);
}

function setTransport(transport: SpaceMouseTransport | null): void {
  activeTransport = transport;
  useSpaceMouseStore.getState().setTransport(transport);
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

function loadModule(): Promise<WebHidModule> {
  if (!modulePromise) modulePromise = import('spacemouse-webhid');
  return modulePromise;
}

function isSpaceMouseDevice(mod: WebHidModule, dev: HIDDevice): boolean {
  return Object.values(mod.PRODUCTS).some(
    (p) => p.vendorId === dev.vendorId && p.productId === dev.productId
  );
}

function detachCurrent(): void {
  if (!device) return;
  try {
    device.removeAllListeners();
    void device.close();
  } catch {
    // Device may already be gone; nothing to clean up.
  }
  device = null;
}

function handleDeviceLost(): void {
  detachCurrent();
  spaceMouseBus.resetDeflection();
  // A second puck may still be attached; otherwise fall back to idle.
  void tryAutoConnect();
}

function wireEvents(sm: SpaceMouseDevice): void {
  sm.on('translate', (t) => spaceMouseBus.setTranslation({ x: t.x, y: t.y, z: t.z }));
  sm.on('rotate', (r) => spaceMouseBus.setRotation({ pitch: r.pitch, roll: r.roll, yaw: r.yaw }));
  sm.on('down', (buttonIndex) => spaceMouseBus.pressButton(buttonIndex));
  sm.on('error', handleDeviceLost);
  sm.on('disconnected', handleDeviceLost);
}

async function attach(mod: WebHidModule, hidDevice: HIDDevice): Promise<void> {
  detachCurrent();
  setConnection('connecting');
  const sm = await mod.setupSpaceMouse(hidDevice);
  device = sm;
  wireEvents(sm);
  setConnection('connected', sm.info.name || hidDevice.productName || 'SpaceMouse');
}

async function tryAutoConnect(): Promise<void> {
  if (!isWebHidSupported()) {
    setConnection('unsupported', null);
    return;
  }
  try {
    const mod = await loadModule();
    const granted = await mod.getOpenedSpaceMice();
    const match = granted.find((d) => isSpaceMouseDevice(mod, d));
    if (match) {
      await attach(mod, match);
    } else if (!device) {
      setConnection('idle', null);
    }
  } catch {
    setConnection('error');
  }
}

function onHidConnect(event: HIDConnectionEvent): void {
  if (device) return;
  void (async () => {
    const mod = await loadModule();
    if (isSpaceMouseDevice(mod, event.device)) {
      await attach(mod, event.device).catch(() => setConnection('error'));
    }
  })();
}

function onHidDisconnect(): void {
  if (device) handleDeviceLost();
}

/**
 * `hasFocus()` is the gate rather than `visibilityState`: the case reported in
 * #4041 is a window that is fully visible but not frontmost, which still counts
 * as `visible`. The listeners below are only triggers to re-read it.
 */
function syncFocus(): void {
  spaceMouseBus.setFocused(document.hasFocus());
}

/** Start the raw-HID transport (the fallback when no driver is present). */
function startWebHid(): void {
  setTransport('webhid');
  if (!isWebHidSupported()) {
    setConnection('unsupported', null);
    return;
  }
  navigator.hid.addEventListener('connect', onHidConnect);
  navigator.hid.addEventListener('disconnect', onHidDisconnect);
  window.addEventListener('focus', syncFocus);
  window.addEventListener('blur', syncFocus);
  document.addEventListener('visibilitychange', syncFocus);
  syncFocus();
  void tryAutoConnect();
}

function stopWebHid(): void {
  if (isWebHidSupported()) {
    navigator.hid.removeEventListener('connect', onHidConnect);
    navigator.hid.removeEventListener('disconnect', onHidDisconnect);
    window.removeEventListener('focus', syncFocus);
    window.removeEventListener('blur', syncFocus);
    document.removeEventListener('visibilitychange', syncFocus);
  }
  spaceMouseBus.setFocused(true);
  detachCurrent();
  spaceMouseBus.resetDeflection();
}

/** navlib was unavailable or dropped: switch to the raw-HID path, once. */
function fallbackToWebHid(): void {
  if (!started || activeTransport === 'webhid') return;
  startWebHid();
}

/**
 * Prefer the 3Dconnexion driver (per-app speed/axis config, appears by name in
 * the control panel); fall back to WebHID when the driver is absent or won't
 * serve this origin. One transport is active at a time.
 */
async function selectTransport(): Promise<void> {
  const hasDriver = await probeDriver();
  if (!started) return; // stopped while probing
  if (hasDriver) {
    setTransport('navlib');
    await startNavlib({ onDisconnect: fallbackToWebHid });
  } else {
    startWebHid();
  }
}

export function startSpaceMouse(): void {
  if (started) return;
  started = true;
  // Load the undo/redo handler lazily so importing this module (e.g. for the
  // Labs pairing button) doesn't drag in the command/history store graph. Needed
  // by both transports.
  void import('./commands').then((m) => {
    if (started) spaceMouseBus.setGlobalHandler(m.runGlobalCommand);
  });
  void selectTransport();
}

export function stopSpaceMouse(): void {
  if (!started) return;
  started = false;
  if (activeTransport === 'navlib') stopNavlib();
  stopWebHid();
  setTransport(null);
  spaceMouseBus.setGlobalHandler(null);
  setConnection(isWebHidSupported() ? 'idle' : 'unsupported', null);
}

/**
 * Prompt the user to pair a SpaceMouse. Must be called from a user gesture
 * (WebHID requires one for the permission dialog).
 */
export async function requestSpaceMousePairing(): Promise<void> {
  if (!isWebHidSupported()) {
    setConnection('unsupported', null);
    return;
  }
  try {
    const mod = await loadModule();
    setConnection('connecting');
    const chosen = await mod.requestSpaceMice();
    if (chosen.length === 0) {
      // User dismissed the dialog without choosing.
      setConnection(device ? 'connected' : 'idle');
      return;
    }
    await attach(mod, chosen.find((d) => isSpaceMouseDevice(mod, d)) ?? chosen[0]);
  } catch {
    setConnection('error');
  }
}
