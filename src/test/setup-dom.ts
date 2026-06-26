// src/test/setup-dom.ts
// DOM-specific test setup — used by the "dom" vitest workspace project.
// Base setup (i18n mock) is loaded separately via vitest.workspace.ts setupFiles.

import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetWebGLDetectionCacheForTests } from '@/shared/webgl/detectWebGL';

// Suppress jsdom-environment noise from Three.js / React Three Fiber.
if (typeof window !== 'undefined') {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Multiple instances of Three.js')) return;
    originalWarn(...args);
  };

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
      if (args[0].includes('is using incorrect casing')) return;
      if (
        args[0].startsWith('React does not recognize the') &&
        args[0].includes('prop on a DOM element')
      )
        return;
    }
    originalError(...args);
  };
}

// Mock pointer capture methods not implemented in jsdom
if (typeof Element !== 'undefined') {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// jsdom returns null for any WebGL context; teach getContext to return a
// non-lost context object instead so detectWebGL() resolves "available" by
// default. Tests covering the WebGL-unavailable path override this locally
// with vi.spyOn.
if (typeof HTMLCanvasElement !== 'undefined') {
  // Includes getShaderPrecisionFormat so detectWebGL()'s precision probe passes;
  // tests covering the broken-context path override this locally with vi.spyOn.
  const minimalWebGl = {
    isContextLost: () => false,
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
  } as unknown as WebGLRenderingContext;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown
  ): RenderingContext | null {
    if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
      return minimalWebGl;
    }
    return originalGetContext.call(this, contextId as '2d', options);
  } as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof window !== 'undefined') {
  // Mock matchMedia for responsive hook tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Mock ResizeObserver for components that use it
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback(
        [
          {
            contentRect: { width: 800, height: 400 } as DOMRectReadOnly,
            target: document.body,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this
      );
    }
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver;
}

// Global cleanup for React components
afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
  resetWebGLDetectionCacheForTests();
});
