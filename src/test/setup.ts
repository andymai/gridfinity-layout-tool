import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Guard DOM-specific mocks for tests running in Node.js environment
if (typeof Element !== 'undefined') {
  // Mock pointer capture methods not implemented in jsdom
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
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
}

// Global cleanup for React components
// This catches component cleanup that individual tests might miss
afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
});
