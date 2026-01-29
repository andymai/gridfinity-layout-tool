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
  downloadLayoutAsFile,
  importLayoutResult,
  exportLayoutJSON,
  exportLayoutJSONWithDesigns,
  restoreEmbeddedDesigns,
} from '@/core/storage';
import type { Layout } from '@/core/types';
import { getUserMessage, ok, err, storageNotFound } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { expectOk, expectErr } from '@/test/testUtils';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};

// Mock URL and document for tests
const originalWindow = global.window;
const originalNavigator = global.navigator;
const originalDocument = global.document;

// Mock DesignerStorage
const mockLoadDesign = vi.fn();
const mockSaveDesign = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  loadDesign: (...args: unknown[]) => mockLoadDesign(...args),
  saveDesign: (...args: unknown[]) => mockSaveDesign(...args),
}));

describe('storage-share', () => {
  // Create a test layout
  const createTestLayout = (): Layout => ({
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'cat-1', name: 'Red', color: '#ff0000' }],
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
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

    it('creates and triggers download link', async () => {
      const layout = createTestLayout();
      await downloadLayoutAsFile(layout);

      expect(mockAnchor.download).toBe('test-layout.json');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockURL.createObjectURL).toHaveBeenCalled();
      expect(mockURL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('uses custom filename if provided', async () => {
      const layout = createTestLayout();
      await downloadLayoutAsFile(layout, 'custom-name.json');

      expect(mockAnchor.download).toBe('custom-name.json');
    });

    it('sanitizes layout name for filename', async () => {
      const layout = createTestLayout();
      layout.name = 'Test Layout with Special!@#$%^&*() Chars';
      await downloadLayoutAsFile(layout);

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
      const originalBin = layout.bins.find((b) => b.label === 'Test Bin');
      const decodedBin = decoded.bins.find((b) => b.label === 'Test Bin');
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

      const value = expectOk(result);
      expect(value.name).toBe(layout.name);
      expect(value.drawer).toEqual(layout.drawer);
    });

    it('returns Err with ValidationImportError on invalid JSON', () => {
      const result = importLayoutResult('not valid json{{{');

      const error = expectErr(result);
      expect(error.code).toBe('VALIDATION_IMPORT_FAILED');
      expect(error.kind).toBe('ValidationError');
      expect(error.errors.length).toBeGreaterThan(0);
      expect(error.errors[0]).toContain('Parse error');
    });

    it('returns Err with validation errors on invalid layout structure', () => {
      const result = importLayoutResult(JSON.stringify({ invalid: 'data' }));

      const error = expectErr(result);
      expect(error.code).toBe('VALIDATION_IMPORT_FAILED');
      expect(error.errors.length).toBeGreaterThan(0);
      // Errors should describe what's missing
      expect(error.errors.some((e) => e.includes('drawer') || e.includes('Missing'))).toBe(true);
    });

    it('provides user-friendly message via getUserMessage', () => {
      const result = importLayoutResult('invalid');

      const error = expectErr(result);
      const message = getUserMessage(error);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('regenerates IDs to prevent collisions', () => {
      const layout = createTestLayout();
      const json = exportLayoutJSON(layout);

      const result = importLayoutResult(json);

      const value = expectOk(result);
      // IDs should be different from original
      expect(value.layers[0].id).not.toBe(layout.layers[0].id);
      expect(value.categories[0].id).not.toBe(layout.categories[0].id);
      expect(value.bins[0].id).not.toBe(layout.bins[0].id);
    });
  });

  describe('decodeLayoutResult', () => {
    it('returns Ok with layout on successful decode', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);

      const result = decodeLayoutResult(encoded);

      const value = expectOk(result);
      expect(value.name).toBe(layout.name);
    });

    it('returns Err on invalid encoded string', () => {
      const result = decodeLayoutResult('invalid!!!');

      const error = expectErr(result);
      expect(error.code).toBe('VALIDATION_IMPORT_FAILED');
      expect(error.errors.length).toBeGreaterThan(0);
    });

    it('returns Err on corrupted base64', () => {
      // Valid base64 but not valid JSON inside
      const result = decodeLayoutResult('aGVsbG8gd29ybGQ'); // "hello world" in base64

      const error = expectErr(result);
      expect(error.code).toBe('VALIDATION_IMPORT_FAILED');
    });

    it('round-trip works with Result API', () => {
      const layout = createTestLayout();
      const encoded = encodeLayoutForURL(layout);
      const result = decodeLayoutResult(encoded);

      const value = expectOk(result);
      // Verify the decoded layout has same structure
      expect(value.drawer).toEqual(layout.drawer);
      expect(value.bins.length).toBe(layout.bins.length);
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
      const value = expectOk(result!);
      expect(value.name).toBe(layout.name);
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
      const error = expectErr(result!);
      expect(error.code).toBe('VALIDATION_IMPORT_FAILED');
      expect(error.errors.length).toBeGreaterThan(0);
    });
  });

  // === Linked Design Export/Import ===

  describe('exportLayoutJSONWithDesigns', () => {
    const createLayoutWithLinkedDesigns = (): Layout => {
      const layout = createTestLayout();
      layout.bins = layout.bins.map((bin, i) => ({
        ...bin,
        linkedDesignId: i === 0 ? 'design-1' : undefined,
      }));
      return layout;
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('exports layout without linked designs (no linkedDesigns key in output)', async () => {
      const layout = createTestLayout();
      const json = await exportLayoutJSONWithDesigns(layout);

      const parsed = JSON.parse(json);
      expect(parsed.linkedDesigns).toBeUndefined();
      expect(parsed._meta).toBeDefined();
      expect(parsed._meta.exportedFrom).toBe('https://gridfinitylayouttool.com');
    });

    it('exports layout with linked designs (embeds linkedDesigns array)', async () => {
      const layout = createLayoutWithLinkedDesigns();

      // Mock loadDesign to return a valid design
      mockLoadDesign.mockResolvedValue(
        ok({
          id: 'design-1',
          name: 'Test Bin',
          params: { ...DEFAULT_BIN_PARAMS },
          thumbnail: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          exportFileNameConfig: null,
        })
      );

      const json = await exportLayoutJSONWithDesigns(layout);
      const parsed = JSON.parse(json);

      expect(parsed.linkedDesigns).toBeDefined();
      expect(Array.isArray(parsed.linkedDesigns)).toBe(true);
      expect(parsed.linkedDesigns).toHaveLength(1);
      expect(parsed.linkedDesigns[0]).toEqual({
        id: 'design-1',
        name: 'Test Bin',
        params: DEFAULT_BIN_PARAMS,
      });
      expect(mockLoadDesign).toHaveBeenCalledWith('design-1');
    });

    it('omits designs that cannot be found in IndexedDB (deleted designs)', async () => {
      const layout = createLayoutWithLinkedDesigns();

      // Mock loadDesign to return not found error
      mockLoadDesign.mockResolvedValue(err(storageNotFound('design-1')));

      const json = await exportLayoutJSONWithDesigns(layout);
      const parsed = JSON.parse(json);

      // Should not include linkedDesigns key when no designs were found
      expect(parsed.linkedDesigns).toBeUndefined();
      expect(mockLoadDesign).toHaveBeenCalledWith('design-1');
    });

    it('includes only found designs when some are missing', async () => {
      const layout = createTestLayout();
      layout.bins = [
        { ...layout.bins[0], linkedDesignId: 'design-1' },
        { ...layout.bins[0], id: 'bin-2', x: 2, linkedDesignId: 'design-2' },
      ];

      // Mock loadDesign: design-1 found, design-2 not found
      mockLoadDesign
        .mockResolvedValueOnce(
          ok({
            id: 'design-1',
            name: 'Found Design',
            params: { ...DEFAULT_BIN_PARAMS },
            thumbnail: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            exportFileNameConfig: null,
          })
        )
        .mockResolvedValueOnce(err(storageNotFound('design-2')));

      const json = await exportLayoutJSONWithDesigns(layout);
      const parsed = JSON.parse(json);

      expect(parsed.linkedDesigns).toBeDefined();
      expect(parsed.linkedDesigns).toHaveLength(1);
      expect(parsed.linkedDesigns[0].id).toBe('design-1');
    });
  });

  describe('restoreEmbeddedDesigns', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns unchanged layout when no linkedDesigns in JSON', async () => {
      const layout = createTestLayout();
      const json = JSON.stringify(layout);

      const result = await restoreEmbeddedDesigns(json, layout);

      expect(result.layout).toEqual(layout);
      expect(result.importedDesignCount).toBe(0);
      expect(mockSaveDesign).not.toHaveBeenCalled();
    });

    it('returns unchanged layout for invalid JSON', async () => {
      const layout = createTestLayout();
      const json = 'invalid json {{{';

      const result = await restoreEmbeddedDesigns(json, layout);

      expect(result.layout).toEqual(layout);
      expect(result.importedDesignCount).toBe(0);
      expect(mockSaveDesign).not.toHaveBeenCalled();
    });

    it('saves each embedded design to IndexedDB with fresh IDs', async () => {
      const layout = createTestLayout();
      layout.bins[0].linkedDesignId = 'old-design-id';

      const json = JSON.stringify({
        ...layout,
        linkedDesigns: [
          {
            id: 'old-design-id',
            name: 'Test Design',
            params: { ...DEFAULT_BIN_PARAMS },
          },
        ],
      });

      // Mock saveDesign to return a new ID
      mockSaveDesign.mockResolvedValue(
        ok({
          id: 'new-design-id',
          name: 'Test Design',
          params: { ...DEFAULT_BIN_PARAMS },
          thumbnail: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          exportFileNameConfig: null,
        })
      );

      const result = await restoreEmbeddedDesigns(json, layout);

      expect(result.importedDesignCount).toBe(1);
      expect(mockSaveDesign).toHaveBeenCalledWith({
        name: 'Test Design',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });
    });

    it('updates linkedDesignId references on bins', async () => {
      const layout = createTestLayout();
      layout.bins[0].linkedDesignId = 'old-design-id';

      const json = JSON.stringify({
        ...layout,
        linkedDesigns: [
          {
            id: 'old-design-id',
            name: 'Test Design',
            params: { ...DEFAULT_BIN_PARAMS },
          },
        ],
      });

      mockSaveDesign.mockResolvedValue(
        ok({
          id: 'new-design-id',
          name: 'Test Design',
          params: { ...DEFAULT_BIN_PARAMS },
          thumbnail: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          exportFileNameConfig: null,
        })
      );

      const result = await restoreEmbeddedDesigns(json, layout);

      expect(result.layout.bins[0].linkedDesignId).toBe('new-design-id');
    });

    it('handles invalid/malformed design entries gracefully', async () => {
      const layout = createTestLayout();

      const json = JSON.stringify({
        ...layout,
        linkedDesigns: [
          { id: 'valid-id', name: 'Valid Design', params: { ...DEFAULT_BIN_PARAMS } },
          { id: 'missing-name' }, // Missing name and params
          null, // Null entry
          'not an object', // Invalid type
          { name: 'No ID', params: {} }, // Missing id
        ],
      });

      mockSaveDesign.mockResolvedValue(
        ok({
          id: 'new-design-id',
          name: 'Valid Design',
          params: { ...DEFAULT_BIN_PARAMS },
          thumbnail: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          exportFileNameConfig: null,
        })
      );

      const result = await restoreEmbeddedDesigns(json, layout);

      // Only valid design should be saved
      expect(result.importedDesignCount).toBe(1);
      expect(mockSaveDesign).toHaveBeenCalledTimes(1);
    });

    it('handles saveDesign failures gracefully', async () => {
      const layout = createTestLayout();
      layout.bins[0].linkedDesignId = 'design-1';

      const json = JSON.stringify({
        ...layout,
        linkedDesigns: [{ id: 'design-1', name: 'Test', params: { ...DEFAULT_BIN_PARAMS } }],
      });

      // Mock saveDesign to fail
      mockSaveDesign.mockResolvedValue(err(storageNotFound('storage unavailable')));

      const result = await restoreEmbeddedDesigns(json, layout);

      expect(result.importedDesignCount).toBe(0);
      expect(result.layout.bins[0].linkedDesignId).toBe('design-1'); // Unchanged
    });

    it('processes multiple designs correctly', async () => {
      const layout = createTestLayout();
      layout.bins = [
        { ...layout.bins[0], linkedDesignId: 'design-1' },
        { ...layout.bins[0], id: 'bin-2', x: 2, linkedDesignId: 'design-2' },
      ];

      const json = JSON.stringify({
        ...layout,
        linkedDesigns: [
          { id: 'design-1', name: 'Design 1', params: { ...DEFAULT_BIN_PARAMS, width: 2 } },
          { id: 'design-2', name: 'Design 2', params: { ...DEFAULT_BIN_PARAMS, width: 3 } },
        ],
      });

      mockSaveDesign
        .mockResolvedValueOnce(
          ok({
            id: 'new-id-1',
            name: 'Design 1',
            params: { ...DEFAULT_BIN_PARAMS, width: 2 },
            thumbnail: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            exportFileNameConfig: null,
          })
        )
        .mockResolvedValueOnce(
          ok({
            id: 'new-id-2',
            name: 'Design 2',
            params: { ...DEFAULT_BIN_PARAMS, width: 3 },
            thumbnail: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            exportFileNameConfig: null,
          })
        );

      const result = await restoreEmbeddedDesigns(json, layout);

      expect(result.importedDesignCount).toBe(2);
      expect(result.layout.bins[0].linkedDesignId).toBe('new-id-1');
      expect(result.layout.bins[1].linkedDesignId).toBe('new-id-2');
    });
  });
});
