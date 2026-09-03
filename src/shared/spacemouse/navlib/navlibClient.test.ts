import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spaceMouseBus } from '../spaceMouseBus';
import type { NavlibClient } from './tdxTypes';
import type { NavlibViewAccessors } from './types';

const captureException = vi.fn();
vi.mock('@/shared/analytics/posthog/eventsErrors', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

const driver = vi.hoisted(() => ({
  client: null as NavlibClient | null,
  created: 0,
  writes: [] as unknown[],
}));
vi.mock('./tdx', () => {
  class Node {
    push(node: unknown): unknown {
      return node;
    }
  }
  class FakeNavlib {
    static nlOptions = { none: 0, rowMajorOrder: 1 };
    static ActionTree = Node;
    static ActionSet = Node;
    static Category = Node;
    static Action = Node;
    static ImageCache = Node;
    static ImageItem = { fromURL: (): { id: string } => ({ id: '' }) };
    version = '0.0';
    private readonly client: NavlibClient;
    constructor(client: NavlibClient) {
      this.client = client;
      driver.client = client;
    }
    connect(): number {
      this.client.onConnect();
      return 1;
    }
    create3dmouse(): void {
      driver.created += 1;
    }
    update3dcontroller(value: Record<string, unknown>): Promise<unknown> {
      driver.writes.push(value);
      return Promise.reject(new Error('socket closed'));
    }
    read3dcontroller(): Promise<unknown> {
      return Promise.resolve(undefined);
    }
    delete3dmouse(): void {}
    close(): void {}
  }
  return { loadNavlib: (): Promise<unknown> => Promise.resolve(FakeNavlib) };
});

import { buildClient, guardCall, guardRead, startNavlib, stopNavlib } from './navlibClient';

type AnyFn = (arg?: unknown) => unknown;

const reportedProperties = (): string[] =>
  captureException.mock.calls.map((call) => (call[1] as { property: string }).property).sort();

describe('navlib wire-boundary guards', () => {
  beforeEach(() => {
    stopNavlib();
    captureException.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('passes a value through and substitutes the fallback for null or undefined', () => {
    expect(guardRead('a', [0], () => [1, 2])()).toEqual([1, 2]);
    expect(guardRead<number[] | null>('b', [0], () => null)()).toEqual([0]);
    expect(guardRead('c', 'x', () => undefined)()).toBe('x');
    expect(guardRead('d', true, () => false)()).toBe(false);
  });

  it('hands out a fresh copy of an array fallback', () => {
    const read = guardRead('a', [0, 0], () => undefined);
    read()[0] = 9;
    expect(read()).toEqual([0, 0]);
  });

  it('answers with the fallback when the read throws, and reports once per property', async () => {
    const read = guardRead<number[] | null>('hit.lookat', null, () => {
      throw new TypeError("Cannot read properties of null (reading 'near')");
    });
    expect(read()).toBeNull();
    expect(read()).toBeNull();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
    expect(captureException.mock.calls[0][1]).toMatchObject({
      boundary: 'spacemouse-navlib',
      property: 'hit.lookat',
    });
  });

  it('swallows a throwing call', async () => {
    const write = guardCall('transaction', (_transaction: number) => {
      throw new Error('boom');
    });
    expect(() => write(0)).not.toThrow();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
  });

  it('guards every entry of the built client', () => {
    const throwing = new Proxy({} as NavlibViewAccessors, {
      get: () => () => {
        throw new Error('boom');
      },
    });
    const unregister = spaceMouseBus.register({
      id: 'throwing-canvas',
      runCommand: () => {
        throw new Error('boom');
      },
      invalidate: () => {},
    });
    const args: Record<string, unknown> = {
      setTransaction: 0,
      setActiveCommand: 'fit',
      setViewMatrix: [],
      setViewExtents: [],
      setLookFrom: [],
      setLookDirection: [],
      setLookAperture: 0.01,
      setSelectionOnly: false,
    };
    const entries = (client: NavlibClient): Array<[string, AnyFn]> =>
      Object.entries(client) as Array<[string, AnyFn]>;
    const expectAllGuarded = (): void => {
      const idle = Object.fromEntries(
        entries(buildClient(() => null)).map(([name, fn]) => [name, fn(args[name])])
      );
      for (const [name, fn] of entries(buildClient(() => throwing))) {
        let result: unknown;
        expect(() => {
          result = fn(args[name]);
        }, name).not.toThrow();
        expect(result, name).toEqual(idle[name]);
      }
    };
    try {
      // Pass one breaks starting a frame pump, pass two breaks stopping one.
      vi.stubGlobal('requestAnimationFrame', () => {
        throw new Error('no rAF');
      });
      vi.stubGlobal('cancelAnimationFrame', () => {});
      expectAllGuarded();
      vi.stubGlobal('requestAnimationFrame', () => 1);
      vi.stubGlobal('cancelAnimationFrame', () => {
        throw new Error('no cAF');
      });
      expectAllGuarded();
    } finally {
      unregister();
      // Pass two left a frame id behind; clear it before the stub goes away.
      vi.stubGlobal('cancelAnimationFrame', () => {});
      buildClient(() => null).onStopMotion?.();
    }
  });

  it('connects through the driver constructor and reports rejected setup writes', async () => {
    vi.stubGlobal('window', globalThis);
    driver.created = 0;
    driver.writes = [];
    const onDisconnect = vi.fn();
    await startNavlib({ onDisconnect });
    expect(driver.created).toBe(1);
    driver.client?.on3dmouseCreated?.();
    await vi.waitFor(() => expect(driver.writes).toHaveLength(2));
    expect(driver.writes[0]).toEqual({ frame: { timingSource: 1 } });
    expect(driver.writes[1]).toEqual({ commands: expect.anything() });
    await vi.waitFor(() =>
      expect(reportedProperties()).toEqual(['commands.tree', 'frame.timingSource'])
    );
    expect(onDisconnect).not.toHaveBeenCalled();
    driver.client?.onDisconnect?.('closed');
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing disconnect fallback and reports it', async () => {
    vi.stubGlobal('window', globalThis);
    await startNavlib({
      onDisconnect: () => {
        throw new Error('no WebHID');
      },
    });
    expect(() => driver.client?.onDisconnect?.('closed')).not.toThrow();
    await vi.waitFor(() => expect(reportedProperties()).toEqual(['disconnect']));
  });

  it('reports again once the error module loads after a failed attempt', async () => {
    const failing = vi.fn(() => {
      throw new Error('chunk load failed');
    });
    vi.resetModules();
    vi.doMock('@/shared/analytics/posthog/eventsErrors', failing);
    const read = guardRead('view.fov', 1, () => {
      throw new Error('boom');
    });
    try {
      expect(read()).toBe(1);
      await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
    } finally {
      vi.doMock('@/shared/analytics/posthog/eventsErrors', () => ({
        captureException: (...args: unknown[]) => captureException(...args),
      }));
      vi.resetModules();
    }
    // The rejected import released the property, so a retry reaches the module.
    await vi.waitFor(() => {
      read();
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });
});
