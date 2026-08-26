import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  filterExceptionForPosthog,
  resetSessionCaptureCounts,
  shouldIgnoreError,
} from './errorFilters';

const { detectWebGL } = vi.hoisted(() => ({ detectWebGL: vi.fn() }));
vi.mock('@/shared/webgl/detectWebGL', () => ({ detectWebGL }));

beforeEach(() => {
  // Default to "available" so non-WebGL cases behave normally.
  detectWebGL.mockReturnValue({ available: true });
  resetSessionCaptureCounts();
});

describe('shouldIgnoreError — message patterns', () => {
  it.each([
    'Error: No Listener: tabs:outgoing.message.ready',
    'No Listener: tabs:incoming.foo',
    'Invalid call to runtime.sendMessage(). Tab not found.',
    'Extension context invalidated.',
    'Script error.',
    'Script error',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
    // Firefox-for-iOS injected `__firefox__` global / Reader-mode noise
    "ReferenceError: Can't find variable: __firefox__",
    "TypeError: undefined is not an object (evaluating 'window.__firefox__.reader')",
    // iOS in-app browser (WKWebView) bridge-script injection
    "TypeError: undefined is not an object (evaluating 'top.webkit.messageHandlers.foregroundToBackground.postMessage')",
    "TypeError: undefined is not an object (evaluating 'window.webkit.messageHandlers.handler.postMessage')",
  ])('ignores %j', (msg) => {
    expect(shouldIgnoreError(msg)).toBe(true);
  });

  it.each([
    'Cannot read properties of null (reading addEventListener)',
    'Error creating WebGL context',
    'Failed to fetch dynamically imported module',
    'TypeError: foo is not a function',
  ])('does NOT ignore real app error %j', (msg) => {
    expect(shouldIgnoreError(msg)).toBe(false);
  });

  it('ignores empty / undefined message safely', () => {
    expect(shouldIgnoreError(null)).toBe(false);
    expect(shouldIgnoreError(undefined)).toBe(false);
    expect(shouldIgnoreError('')).toBe(false);
  });
});

describe('shouldIgnoreError — source patterns', () => {
  it.each([
    'chrome-extension://abc123/content.js',
    'moz-extension://uuid/script.js',
    'safari-web-extension://abc/foo.js',
    'safari-extension://abc/foo.js',
  ])('ignores %j', (source) => {
    expect(shouldIgnoreError('TypeError: x', source)).toBe(true);
  });

  it('does NOT ignore app sources', () => {
    expect(shouldIgnoreError('TypeError: x', '/assets/main-abc.js')).toBe(false);
    expect(shouldIgnoreError('TypeError: x', 'https://gridfinitylayouttool.com/foo.js')).toBe(
      false
    );
  });
});

describe('filterExceptionForPosthog', () => {
  it('passes non-$exception events through unchanged', () => {
    const e = {
      event: '$pageview',
      properties: { url: '/baseplate', $exception_list: undefined },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('drops $exception events whose $exception_list value matches a filter', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'No Listener: tabs:outgoing.message.ready' }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('drops $exception events using $exception_values fallback', () => {
    const e = {
      event: '$exception',
      properties: { $exception_values: ['Invalid call to runtime.sendMessage(). Tab not found.'] },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('passes $exception events for real app errors through', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'Cannot read properties of null (reading foo)' }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('keeps $exception when only a non-primary cause matches a filter', () => {
    // Real app error wraps an extension error as Error.cause — keep the event,
    // since the user-visible failure is the primary (app) error.
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          { value: 'TypeError: appCode is undefined' },
          { value: 'No Listener: tabs:outgoing.message.ready' },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });
});

describe('filterExceptionForPosthog — WebGL context-creation dedupe', () => {
  it('pins a stable fingerprint so all variants group into one issue', () => {
    const e = {
      event: '$exception',
      properties: { $exception_list: [{ value: 'Error creating WebGL context.' }] },
    };
    const result = filterExceptionForPosthog(e);
    expect(result).toBe(e);
    expect(result?.properties?.$exception_fingerprint).toBe('webgl-context-creation-failed');
  });

  it('keeps the fingerprint stable across different stacks/mount sites', () => {
    const designer = filterExceptionForPosthog({
      event: '$exception',
      properties: { $exception_values: ['Error creating WebGL context'] },
    });
    const baseplate = filterExceptionForPosthog({
      event: '$exception',
      properties: { $exception_values: ['Error creating WebGL context (designer canvas)'] },
    });
    expect(designer?.properties?.$exception_fingerprint).toBe(
      baseplate?.properties?.$exception_fingerprint
    );
  });

  it('drops the burst once detection has been flipped to unavailable', () => {
    detectWebGL.mockReturnValue({ available: false, reason: 'context-failed' });
    const e = {
      event: '$exception',
      properties: { $exception_list: [{ value: 'Error creating WebGL context.' }] },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('does not fingerprint unrelated errors', () => {
    const e = {
      event: '$exception',
      properties: { $exception_list: [{ value: 'TypeError: foo is not a function' }] },
    };
    const result = filterExceptionForPosthog(e);
    expect(result).toBe(e);
    expect(result?.properties?.$exception_fingerprint).toBeUndefined();
  });
});

describe('filterExceptionForPosthog — chunk-load dedupe', () => {
  const fingerprintOf = (value: string): unknown =>
    filterExceptionForPosthog({
      event: '$exception',
      properties: { $exception_list: [{ value }] },
    })?.properties?.$exception_fingerprint;

  it.each([
    [
      'Chrome',
      'TypeError: Failed to fetch dynamically imported module: https://gridfinitylayouttool.com/assets/baseplate-CbgQ-55M.js',
    ],
    [
      'Firefox',
      'TypeError: error loading dynamically imported module: https://gridfinitylayouttool.com/assets/baseplate-CbgQ-55M.js',
    ],
    ['Safari', 'TypeError: Importing a module script failed.'],
  ])('pins the %s wording to one fingerprint', (_engine, value) => {
    expect(fingerprintOf(value)).toBe('chunk-load-failed');
  });

  it('groups across deploys, whose chunk hash and route differ', () => {
    const first = fingerprintOf(
      'Failed to fetch dynamically imported module: https://x/assets/baseplate-AAA.js'
    );
    // The once-per-session gate would mute the second capture; reset so this
    // test only observes the fingerprint pinning.
    resetSessionCaptureCounts();
    const second = fingerprintOf(
      'Failed to fetch dynamically imported module: https://x/assets/designer-ZZZZZZZZ.js'
    );
    expect(first).toBe(second);
  });

  it('leaves a bare network failure alone, which is not necessarily a chunk', () => {
    // `isStaleAssetError` may answer for these because it is only ever asked
    // about a failed kernel load. This hook sees every exception, so matching
    // them here would drag genuine API failures into the chunk bucket.
    expect(fingerprintOf('TypeError: Failed to fetch')).toBeUndefined();
    expect(fingerprintOf('TypeError: Load failed')).toBeUndefined();
  });

  it('reports the first occurrence and mutes the rest of the session', () => {
    const make = (): Parameters<typeof filterExceptionForPosthog>[0] => ({
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'Failed to fetch dynamically imported module: https://x/a.js' }],
      },
    });
    const first = make();
    expect(filterExceptionForPosthog(first)).toBe(first);
    // A stale bundle is one condition for the whole tab: a stale session
    // averages dozens of captures repeating the same fact, and the retries
    // can be captured both natively and by a boundary.
    expect(filterExceptionForPosthog(make())).toBeNull();
    expect(
      filterExceptionForPosthog({
        event: '$exception',
        properties: {
          $exception_list: [{ value: 'TypeError: Importing a module script failed.' }],
        },
      })
    ).toBeNull();
  });
});

describe('filterExceptionForPosthog — per-session capture cap', () => {
  const appError = (value: string): Parameters<typeof filterExceptionForPosthog>[0] => ({
    event: '$exception',
    properties: { $exception_list: [{ type: 'TypeError', value }] },
  });

  it('caps one looping identity without touching others', () => {
    for (let i = 0; i < 10; i++) {
      expect(filterExceptionForPosthog(appError('x is not a function'))).not.toBeNull();
    }
    expect(filterExceptionForPosthog(appError('x is not a function'))).toBeNull();
    expect(filterExceptionForPosthog(appError('x is not a function'))).toBeNull();

    // A different identity is unaffected by the exhausted one.
    expect(filterExceptionForPosthog(appError('y is undefined'))).not.toBeNull();
  });

  it('caps a pinned-fingerprint burst the once-per-session gates miss', () => {
    // WebGL context failures are muted only after detection flips to
    // unavailable; when the boundary never flips it, this cap is the bound.
    for (let i = 0; i < 10; i++) {
      expect(
        filterExceptionForPosthog({
          event: '$exception',
          properties: { $exception_list: [{ value: 'Error creating WebGL context.' }] },
        })
      ).not.toBeNull();
    }
    expect(
      filterExceptionForPosthog({
        event: '$exception',
        properties: { $exception_list: [{ value: 'Error creating WebGL context.' }] },
      })
    ).toBeNull();
  });

  it('resets with the seam', () => {
    for (let i = 0; i < 11; i++) filterExceptionForPosthog(appError('loop'));
    expect(filterExceptionForPosthog(appError('loop'))).toBeNull();
    resetSessionCaptureCounts();
    expect(filterExceptionForPosthog(appError('loop'))).not.toBeNull();
  });
});

describe('R3F canvas teardown race', () => {
  const CHROME = "Cannot read properties of null (reading 'addEventListener')";
  const canvasFrames = [
    { function: 'Ei' },
    { function: 'onCreated' },
    { function: 'Object.connect' },
  ];

  it('drops the null listener target thrown from the canvas connect path', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: CHROME, stacktrace: { frames: canvasFrames } }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('keeps the same message when no connect frame is involved', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          { value: CHROME, stacktrace: { frames: [{ function: 'useMeasureTool' }] } },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('keeps an unrelated error that happens to run through a connect frame', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          { value: 'TypeError: foo is not a function', stacktrace: { frames: canvasFrames } },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('matches the WebKit phrasing of the same throw', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value: "null is not an object (evaluating 'target.addEventListener')",
            stacktrace: { frames: canvasFrames },
          },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('matches the Firefox phrasing of the same throw', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value: 'can\'t access property "addEventListener", t is null',
            stacktrace: { frames: canvasFrames },
          },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('keeps the error when frames are absent entirely', () => {
    const e = {
      event: '$exception',
      properties: { $exception_list: [{ value: CHROME }] },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });
});

describe('WebKit navigation aborts', () => {
  it.each([
    ['no stacktrace at all', { value: 'AbortError: AbortError' }],
    ['empty frames', { value: 'AbortError: AbortError', stacktrace: { frames: [] } }],
    [
      'wordier WebKit phrasing',
      { value: 'AbortError: The operation was aborted.', stacktrace: { frames: [] } },
    ],
  ])('drops a stackless AbortError with %s', (_shape, exception) => {
    const e = { event: '$exception', properties: { $exception_list: [exception] } };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('keeps an AbortError that carries app frames', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value: 'AbortError: AbortError',
            stacktrace: { frames: [{ function: 'loadSharedLayout' }] },
          },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('keeps other stackless DOMExceptions', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'UnknownError: Database deleted by request of the user' }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });
});

describe('extension-sourced exceptions', () => {
  it('drops a throw whose frames come from an extension script', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value: 'TypeError: chrome.runtime is undefined',
            stacktrace: {
              frames: [
                { function: 'x', filename: 'https://gridfinitylayouttool.com/assets/main.js' },
                { function: 'y', filename: 'chrome-extension://abcdef/content.js' },
              ],
            },
          },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('keeps a throw whose frames are all first-party', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value: 'TypeError: cannot read x',
            stacktrace: {
              frames: [
                { function: 'x', filename: 'https://gridfinitylayouttool.com/assets/main.js' },
              ],
            },
          },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('keeps a throw with no frame filenames', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'TypeError: cannot read x', stacktrace: { frames: [{}] } }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });
});
