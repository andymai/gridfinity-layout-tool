import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  encodeLayoutForURL,
  decodeLayoutFromURL,
  decodeLayoutResult,
  generateShareableURL,
  getSharedLayoutFromURL,
  getSharedLayoutResult,
  clearSharedLayoutFromURL,
  copyToClipboard,
  copyToClipboardResult,
  downloadLayoutAsFile,
  importLayoutResult,
  exportLayoutJSON,
} from '../core/storage';
import type { Layout } from '../core/types';
import { isOk, isErr, getUserMessage } from '../core/result';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};

// Mock URL and document for tests
const originalWindow = global.window;
const originalNavigator = global.navigator;
const originalDocument = global.document;

describe('storage-share', () => {
  // Create a test layout
  const createTestLayout = (): Layout => ({
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [
      { id: 'cat-1', name: 'Red', color: '#ff0000' },
    ],
    layers: [
      { id: 'layer-1', name: 'Layer 1', height: 3 },
    ],
    bins: [
      {
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'layer-1',
        category: 'cat-1',
      },
    ],
  });

  describe('encodeLayoutForURL', () => {
    it('encodes a layout to a URL-safe string', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);

      // Should be a non-empty string
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');

      // Should be URL-safe (no +, /, or = characters)
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toMatch(/=$/);
    });

    it('produces consistent encoding for same layout', () => {
      const layout = createTestLayout();
      const encoded1 = encodeLayoutForURL(layout);
      const encoded2 = encodeLayoutForURL(layout);

      expect(encoded1).toBe(encoded2);
    });
  });

  describe('decodeLayoutFromURL', () => {
    it('decodes an encoded layout back to original', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);
      const result = decodeLayoutFromURL(encoded);

      expect(result.errors).toHaveLength(0);
      expect(result.layout).not.toBeNull();

      // Check key properties match (IDs will be regenerated)
      expect(result.layout!.name).toBe(layout.name);
      expect(result.layout!.drawer).toEqual(layout.drawer);
      expect(result.layout!.categories.length).toBe(layout.categories.length);
      expect(result.layout!.layers.length).toBe(layout.layers.length);
      expect(result.layout!.bins.length).toBe(layout.bins.length);
    });

    it('returns errors for invalid encoded string', () => {
      const result = decodeLayoutFromURL('invalid-base64-string!!!');

      expect(result.layout).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns errors for valid base64 but invalid JSON', () => {
      // Base64 encode "not json"
      const encoded = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const result = decodeLayoutFromURL(encoded);

      expect(result.layout).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles URL-safe base64 characters', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);

      // Verify URL-safe characters can be decoded
      const result = decodeLayoutFromURL(encoded);

      expect(result.layout).not.toBeNull();
    });
  });

  describe('generateShareableURL', () => {
    beforeEach(() => {
      // Mock window.location
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            origin: 'https://example.com',
            pathname: '/app',
          },
        },
        writable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      });
    });

    it('generates a URL with #share= hash', () => {
      const layout = createTestLayout();
      const url = generateShareableURL(layout);

      expect(url).toContain('https://example.com/app#share=');
      expect(url.split('#share=')[1]).toBeTruthy();
    });

    it('generates a decodable URL', () => {
      const layout = createTestLayout();
      const url = generateShareableURL(layout);
      const encoded = url.split('#share=')[1];
      const result = decodeLayoutFromURL(encoded);

      expect(result.layout).not.toBeNull();
      expect(result.layout!.name).toBe(layout.name);
    });
  });

  describe('getSharedLayoutFromURL', () => {
    afterEach(() => {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      });
    });

    it('returns null when no share hash in URL', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: '',
          },
        },
        writable: true,
      });

      const result = getSharedLayoutFromURL();
      expect(result).toBeNull();
    });

    it('returns null for non-share hash', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: '#other=value',
          },
        },
        writable: true,
      });

      const result = getSharedLayoutFromURL();
      expect(result).toBeNull();
    });

    it('returns decoded layout when valid share hash present', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);

      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: `#share=${encoded}`,
          },
        },
        writable: true,
      });

      const result = getSharedLayoutFromURL();
      expect(result).not.toBeNull();
      expect(result!.layout).not.toBeNull();
      expect(result!.layout!.name).toBe(layout.name);
    });

    it('returns errors for invalid share hash', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: '#share=invalid!!!',
          },
        },
        writable: true,
      });

      const result = getSharedLayoutFromURL();
      expect(result).not.toBeNull();
      expect(result!.layout).toBeNull();
      expect(result!.errors.length).toBeGreaterThan(0);
    });
  });

  describe('clearSharedLayoutFromURL', () => {
    afterEach(() => {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      });
    });

    it('removes hash from URL', () => {
      const mockReplaceState = vi.fn();

      Object.defineProperty(global, 'window', {
        value: {
          location: {
            href: 'https://example.com/app#share=abc123',
          },
          history: {
            replaceState: mockReplaceState,
          },
        },
        writable: true,
      });

      clearSharedLayoutFromURL();

      expect(mockReplaceState).toHaveBeenCalledWith(null, '', 'https://example.com/app');
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: mockClipboard,
        },
        writable: true,
      });
      mockClipboard.writeText.mockReset();
    });

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('copies text to clipboard successfully', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const result = await copyToClipboard('test text');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('returns false when clipboard fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Failed'));

      // Mock document.createElement to fail as well
      Object.defineProperty(global, 'document', {
        value: {
          createElement: vi.fn().mockImplementation(() => {
            throw new Error('Failed');
          }),
        },
        writable: true,
      });

      const result = await copyToClipboard('test text');

      expect(result).toBe(false);

      Object.defineProperty(global, 'document', {
        value: originalDocument,
        writable: true,
      });
    });
  });

  describe('downloadLayoutAsFile', () => {
    let mockAnchor: { href: string; download: string; click: () => void };
    let mockURL: { createObjectURL: typeof vi.fn; revokeObjectURL: typeof vi.fn };

    beforeEach(() => {
      mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      mockURL = {
        createObjectURL: vi.fn().mockReturnValue('blob:test'),
        revokeObjectURL: vi.fn(),
      };

      Object.defineProperty(global, 'document', {
        value: {
          createElement: vi.fn().mockReturnValue(mockAnchor),
          body: {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
          },
        },
        writable: true,
      });

      Object.defineProperty(global, 'URL', {
        value: mockURL,
        writable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(global, 'document', {
        value: originalDocument,
        writable: true,
      });
    });

    it('creates and triggers download link', () => {
      const layout = createTestLayout();
      downloadLayoutAsFile(layout);

      expect(mockAnchor.download).toBe('test-layout.json');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockURL.createObjectURL).toHaveBeenCalled();
      expect(mockURL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('uses custom filename if provided', () => {
      const layout = createTestLayout();
      downloadLayoutAsFile(layout, 'custom-name.json');

      expect(mockAnchor.download).toBe('custom-name.json');
    });

    it('sanitizes layout name for filename', () => {
      const layout = createTestLayout();
      layout.name = 'Test Layout with Special!@#$%^&*() Chars';
      downloadLayoutAsFile(layout);

      expect(mockAnchor.download).toBe('test-layout-with-special-chars.json');
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('preserves layout data through encode/decode cycle', () => {
      const layout = createTestLayout();

      // Add more complex data
      layout.bins.push({
        id: 'bin-2',
        x: 3,
        y: 3,
        width: 3,
        depth: 2,
        height: 5,
        layerId: 'layer-1',
        category: 'cat-1',
        label: 'Test Bin',
        notes: 'Some notes here',
      });

      const encoded = encodeLayoutForURL(layout);
      const result = decodeLayoutFromURL(encoded);

      expect(result.layout).not.toBeNull();
      expect(result.errors).toHaveLength(0);

      const decoded = result.layout!;

      // Verify structure
      expect(decoded.drawer).toEqual(layout.drawer);
      expect(decoded.printBedSize).toBe(layout.printBedSize);
      expect(decoded.gridUnitMm).toBe(layout.gridUnitMm);
      expect(decoded.heightUnitMm).toBe(layout.heightUnitMm);

      // Verify counts (IDs regenerated, but counts should match)
      expect(decoded.categories.length).toBe(layout.categories.length);
      expect(decoded.layers.length).toBe(layout.layers.length);
      expect(decoded.bins.length).toBe(layout.bins.length);

      // Verify bin data preserved (except IDs)
      const originalBin = layout.bins.find(b => b.label === 'Test Bin');
      const decodedBin = decoded.bins.find(b => b.label === 'Test Bin');
      expect(decodedBin).toBeDefined();
      expect(decodedBin!.position).toEqual(originalBin!.position);
      expect(decodedBin!.size).toEqual(originalBin!.size);
      expect(decodedBin!.notes).toBe(originalBin!.notes);
    });
  });

  // === Result-Based Functions ===

  describe('importLayoutResult', () => {
    it('returns Ok with layout on successful import', () => {
      const layout = createTestLayout();
      const json = exportLayoutJSON(layout);

      const result = importLayoutResult(json);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe(layout.name);
        expect(result.value.drawer).toEqual(layout.drawer);
      }
    });

    it('returns Err with ValidationImportError on invalid JSON', () => {
      const result = importLayoutResult('not valid json{{{');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
        expect(result.error.kind).toBe('ValidationError');
        expect(result.error.errors.length).toBeGreaterThan(0);
        expect(result.error.errors[0]).toContain('Parse error');
      }
    });

    it('returns Err with validation errors on invalid layout structure', () => {
      const result = importLayoutResult(JSON.stringify({ invalid: 'data' }));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
        expect(result.error.errors.length).toBeGreaterThan(0);
        // Errors should describe what's missing
        expect(result.error.errors.some(e => e.includes('drawer') || e.includes('Missing'))).toBe(true);
      }
    });

    it('provides user-friendly message via getUserMessage', () => {
      const result = importLayoutResult('invalid');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const message = getUserMessage(result.error);
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
      }
    });

    it('regenerates IDs to prevent collisions', () => {
      const layout = createTestLayout();
      const json = exportLayoutJSON(layout);

      const result = importLayoutResult(json);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // IDs should be different from original
        expect(result.value.layers[0].id).not.toBe(layout.layers[0].id);
        expect(result.value.categories[0].id).not.toBe(layout.categories[0].id);
        expect(result.value.bins[0].id).not.toBe(layout.bins[0].id);
      }
    });
  });

  describe('decodeLayoutResult', () => {
    it('returns Ok with layout on successful decode', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);

      const result = decodeLayoutResult(encoded);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe(layout.name);
      }
    });

    it('returns Err on invalid encoded string', () => {
      const result = decodeLayoutResult('invalid!!!');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('returns Err on corrupted base64', () => {
      // Valid base64 but not valid JSON inside
      const result = decodeLayoutResult('aGVsbG8gd29ybGQ'); // "hello world" in base64

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
      }
    });

    it('round-trip works with Result API', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);
      const result = decodeLayoutResult(encoded);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Verify the decoded layout has same structure
        expect(result.value.drawer).toEqual(layout.drawer);
        expect(result.value.bins.length).toBe(layout.bins.length);
      }
    });
  });

  describe('getSharedLayoutResult', () => {
    afterEach(() => {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      });
    });

    it('returns null when no share hash in URL', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: '',
          },
        },
        writable: true,
      });

      const result = getSharedLayoutResult();
      expect(result).toBeNull();
    });

    it('returns null for non-share hash', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: '#other=value',
          },
        },
        writable: true,
      });

      const result = getSharedLayoutResult();
      expect(result).toBeNull();
    });

    it('returns Ok with layout when valid share hash present', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);

      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: `#share=${encoded}`,
          },
        },
        writable: true,
      });

      const result = getSharedLayoutResult();
      expect(result).not.toBeNull();
      expect(isOk(result!)).toBe(true);
      if (isOk(result!)) {
        expect(result!.value.name).toBe(layout.name);
      }
    });

    it('returns Err for invalid share hash', () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hash: '#share=invalid!!!',
          },
        },
        writable: true,
      });

      const result = getSharedLayoutResult();
      expect(result).not.toBeNull();
      expect(isErr(result!)).toBe(true);
      if (isErr(result!)) {
        expect(result!.error.code).toBe('VALIDATION_IMPORT_FAILED');
        expect(result!.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('copyToClipboardResult', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: mockClipboard,
        },
        writable: true,
      });
      mockClipboard.writeText.mockReset();
    });

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('returns Ok when clipboard succeeds', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const result = await copyToClipboardResult('test text');

      expect(isOk(result)).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('returns Err when clipboard fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Failed'));

      // Mock document.createElement to fail as well
      Object.defineProperty(global, 'document', {
        value: {
          createElement: vi.fn().mockImplementation(() => {
            throw new Error('Failed');
          }),
        },
        writable: true,
      });

      const result = await copyToClipboardResult('test text');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('UNKNOWN_ERROR');
        expect(result.error.kind).toBe('UnknownError');
      }

      Object.defineProperty(global, 'document', {
        value: originalDocument,
        writable: true,
      });
    });
  });
});
