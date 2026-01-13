import type { Layout, LayoutLibrary, LayoutEntry, LayoutPreview, ThumbnailBin, CollectionMembership } from '../types';
import { validateImport } from './validation';
import { generateId, STAGING_ID } from '../constants';
import { generateUUID } from './uuid';

// Legacy key for single-layout storage (pre-library)
const LEGACY_STORAGE_KEY = 'gridfinity-layout-v1';

// New keys for multi-layout library
const LIBRARY_STORAGE_KEY = 'gridfinity-library-v1';
const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';

/**
 * Get the storage key for a specific layout by ID.
 */
export function getLayoutStorageKey(layoutId: string): string {
  return `${LAYOUT_KEY_PREFIX}${layoutId}`;
}

/**
 * Save layout to localStorage (legacy - for backward compatibility).
 * @deprecated Use saveLayoutById for multi-layout support.
 */
export function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    throw new Error('Storage full. Export your layout to save it.');
  }
}

/**
 * Migrate old layout data to current schema.
 * Adds default values for any missing fields.
 */
function migrateLayout(data: Record<string, unknown>): Record<string, unknown> {
  // Add gridUnitMm and heightUnitMm if missing (added in later version)
  if (data.gridUnitMm === undefined) {
    data.gridUnitMm = 42;
  }
  if (data.heightUnitMm === undefined) {
    data.heightUnitMm = 7;
  }
  // Migrate maxPrintSize (grid units) -> printBedSize (mm)
  const gridUnitMm = (data.gridUnitMm as number) || 42;
  if (data.maxPrintSize !== undefined && data.printBedSize === undefined) {
    // Convert old grid units to mm
    data.printBedSize = (data.maxPrintSize as number) * gridUnitMm;
    delete data.maxPrintSize;
  }
  // Also fix if printBedSize was saved in grid units (< 42 means it's probably not in mm)
  if (data.printBedSize !== undefined && (data.printBedSize as number) < 42) {
    data.printBedSize = (data.printBedSize as number) * gridUnitMm;
  }
  if (data.printBedSize === undefined) {
    data.printBedSize = 256;  // Default 256mm
  }
  return data;
}

/**
 * Load layout from localStorage (legacy - for backward compatibility).
 * @deprecated Use loadLayoutById for multi-layout support.
 */
export function loadLayout(): Layout | null {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return null;

    let parsed = JSON.parse(stored);

    // Migrate old data to current schema
    parsed = migrateLayout(parsed);

    const validation = validateImport(parsed);

    if (!validation.valid) {
      return null;
    }

    return parsed as Layout;
  } catch {
    return null;
  }
}

/**
 * Clear stored layout (legacy - for backward compatibility).
 * @deprecated Use deleteLayoutById for multi-layout support.
 */
export function clearStorage(): void {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

/**
 * Export layout as JSON string.
 * Adds metadata for user reference (source URL, export time).
 */
export function exportLayoutJSON(layout: Layout): string {
  const exportData = {
    ...layout,
    _meta: {
      exportedFrom: 'https://gridfinitylayouttool.com',
      exportedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import layout from JSON string.
 * Regenerates all IDs to prevent collisions.
 */
export function importLayoutJSON(json: string): { layout: Layout | null; errors: string[] } {
  try {
    const parsed = JSON.parse(json);

    // Strip export metadata if present (not part of Layout type)
    if (parsed._meta) {
      delete parsed._meta;
    }

    const validation = validateImport(parsed);

    if (!validation.valid) {
      return { layout: null, errors: validation.errors };
    }

    // Regenerate all IDs
    const layout = parsed as Layout;
    const idMap = new Map<string, string>();

    // Regenerate layer IDs
    layout.layers = layout.layers.map(layer => {
      const newId = generateId();
      idMap.set(layer.id, newId);
      return { ...layer, id: newId };
    });

    // Regenerate category IDs
    layout.categories = layout.categories.map(cat => {
      const newId = generateId();
      idMap.set(cat.id, newId);
      return { ...cat, id: newId };
    });

    // Regenerate bin IDs and update references
    layout.bins = layout.bins.map(bin => ({
      ...bin,
      id: generateId(),
      layerId: bin.layerId === STAGING_ID ? STAGING_ID : (idMap.get(bin.layerId) || bin.layerId),
      category: idMap.get(bin.category) || bin.category,
    }));

    return { layout, errors: [] };
  } catch (e) {
    return { layout: null, errors: [`Parse error: ${(e as Error).message}`] };
  }
}

/**
 * Export print list as TSV for spreadsheet paste.
 * Dynamically adds columns for custom properties that exist in any row.
 */
export function exportPrintListTSV(rows: Array<{
  size: string;
  height: number;
  binCount: number;
  totalPieces: number;
  labels?: string[];
  notes?: string;
  customProperties?: Record<string, string>;
}>): string {
  // Collect all unique custom property keys across all rows
  const customKeys = new Set<string>();
  for (const r of rows) {
    if (r.customProperties) {
      for (const key of Object.keys(r.customProperties)) {
        customKeys.add(key);
      }
    }
  }
  const sortedKeys = Array.from(customKeys).sort();

  // Build header with dynamic custom property columns
  const baseHeader = 'Size\tHeight\tBins\tPieces\tLabel\tNotes';
  const header = sortedKeys.length > 0
    ? `${baseHeader}\t${sortedKeys.join('\t')}`
    : baseHeader;

  // Build data rows
  const lines = rows.map(r => {
    const label = r.labels?.[0] || '';
    const notes = r.notes || '';
    const baseLine = `${r.size}\t${r.height}u\t${r.binCount}\t${r.totalPieces}\t${label}\t${notes}`;

    if (sortedKeys.length === 0) {
      return baseLine;
    }

    // Add custom property values in order
    const customValues = sortedKeys.map(key => r.customProperties?.[key] || '');
    return `${baseLine}\t${customValues.join('\t')}`;
  });

  return [header, ...lines].join('\n');
}

/**
 * Get storage usage percentage.
 */
export function getStorageUsage(): number {
  try {
    let total = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        total += localStorage[key].length * 2; // UTF-16
      }
    }
    // Assume 5MB limit
    return Math.round((total / (5 * 1024 * 1024)) * 100);
  } catch {
    return 0;
  }
}

// === Layout Library Storage ===

/**
 * Save a layout to localStorage by its ID.
 */
export function saveLayoutById(layoutId: string, layout: Layout): void {
  try {
    const key = getLayoutStorageKey(layoutId);
    localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    throw new Error('Storage full. Export your layout to save it.');
  }
}

/**
 * Load a layout from localStorage by its ID.
 */
export function loadLayoutById(layoutId: string): Layout | null {
  try {
    const key = getLayoutStorageKey(layoutId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    let parsed = JSON.parse(stored);
    parsed = migrateLayout(parsed);

    const validation = validateImport(parsed);
    if (!validation.valid) {
      console.warn(`Layout ${layoutId} failed validation:`, validation.errors);
      return null;
    }

    return parsed as Layout;
  } catch (error) {
    console.error(`Failed to load layout ${layoutId}:`, error);
    return null;
  }
}

/**
 * Delete a layout from localStorage by its ID.
 */
export function deleteLayoutById(layoutId: string): void {
  const key = getLayoutStorageKey(layoutId);
  localStorage.removeItem(key);
}

/**
 * Save the layout library index to localStorage.
 */
export function saveLibrary(library: LayoutLibrary): void {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
  } catch {
    throw new Error('Storage full. Export your layouts to save them.');
  }
}

/**
 * Load the layout library index from localStorage.
 */
export function loadLibrary(): LayoutLibrary | null {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Basic validation
    if (!parsed.version || !parsed.activeLayoutId || !Array.isArray(parsed.entries)) {
      console.warn('Invalid library format');
      return null;
    }

    // Validate each entry exists in storage (clean up orphaned entries)
    const validEntries = parsed.entries.filter((entry: LayoutEntry) => {
      const key = getLayoutStorageKey(entry.id);
      const exists = localStorage.getItem(key) !== null;
      if (!exists) {
        console.warn(`Layout ${entry.id} listed in library but not found in storage, removing`);
      }
      return exists;
    });

    // If we lost some entries, update the library
    if (validEntries.length < parsed.entries.length) {
      parsed.entries = validEntries;

      // If active layout was removed, switch to first available
      if (!validEntries.some((e: LayoutEntry) => e.id === parsed.activeLayoutId)) {
        parsed.activeLayoutId = validEntries[0]?.id || '';
      }
    }

    return parsed as LayoutLibrary;
  } catch (error) {
    console.error('Failed to load library:', error);
    return null;
  }
}

/**
 * Compute preview data from a layout.
 * Includes binMap for thumbnail rendering (top-down view of all bins).
 */
export function computeLayoutPreview(layout: Layout): LayoutPreview {
  // Build category color lookup
  const categoryColors = new Map<string, string>();
  for (const cat of layout.categories) {
    categoryColors.set(cat.id, cat.color);
  }

  // Generate bin map for thumbnail (exclude staged bins)
  const binMap: ThumbnailBin[] = layout.bins
    .filter(bin => bin.layerId !== STAGING_ID)
    .map(bin => ({
      x: bin.x,
      y: bin.y,
      w: bin.width,
      d: bin.depth,
      c: categoryColors.get(bin.category) || '#6B7280', // fallback gray
    }));

  return {
    drawerWidth: layout.drawer.width,
    drawerDepth: layout.drawer.depth,
    drawerHeight: layout.drawer.height,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    binMap,
  };
}

/**
 * Check if legacy single-layout storage exists.
 */
export function hasLegacyLayout(): boolean {
  return localStorage.getItem(LEGACY_STORAGE_KEY) !== null;
}

/**
 * Migrate from legacy single-layout storage to library system.
 * Returns the migrated library, or null if no legacy layout exists.
 */
export function migrateFromLegacyStorage(): LayoutLibrary | null {
  const legacyLayout = loadLayout(); // Uses the old loadLayout function
  if (!legacyLayout) return null;

  const layoutId = generateUUID();
  const now = Date.now();

  // Create library with single entry
  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: layoutId,
    settings: {},
    entries: [{
      id: layoutId,
      name: legacyLayout.name || 'Untitled layout',
      createdAt: now,
      modifiedAt: now,
      preview: computeLayoutPreview(legacyLayout),
    }],
  };

  // Save layout under new key
  saveLayoutById(layoutId, legacyLayout);

  // Save library index
  saveLibrary(library);

  // Remove legacy key
  localStorage.removeItem(LEGACY_STORAGE_KEY);

  return library;
}

// === Layout Sharing ===

/**
 * Compress a string using gzip-like compression via pako if available,
 * otherwise fall back to simple encoding.
 */
function compressString(str: string): string {
  // Use native compression if available (modern browsers)
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    // Simple RLE-like compression for JSON (many repeated chars)
    return btoa(String.fromCharCode(...data));
  } catch {
    return btoa(str);
  }
}

/**
 * Decompress a string.
 */
function decompressString(compressed: string): string {
  try {
    const binary = atob(compressed);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch {
    return atob(compressed);
  }
}

/**
 * Encode a layout for URL sharing.
 * Returns a base64-encoded string safe for URL hash.
 */
export function encodeLayoutForURL(layout: Layout): string {
  const json = JSON.stringify(layout);
  const compressed = compressString(json);
  // Make base64 URL-safe
  return compressed.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a layout from URL-encoded string.
 * Returns the layout or null if invalid.
 */
export function decodeLayoutFromURL(encoded: string): { layout: Layout | null; errors: string[] } {
  try {
    // Restore base64 from URL-safe version
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add back padding
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = decompressString(base64);
    return importLayoutJSON(json);
  } catch (e) {
    return { layout: null, errors: [`Failed to decode URL: ${(e as Error).message}`] };
  }
}

/**
 * Generate a shareable URL for a layout.
 * The layout is encoded in the URL hash.
 */
export function generateShareableURL(layout: Layout): string {
  const encoded = encodeLayoutForURL(layout);
  const baseURL = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  return `${baseURL}#share=${encoded}`;
}

/**
 * Check if the current URL contains a shared layout.
 */
export function getSharedLayoutFromURL(): { layout: Layout | null; errors: string[] } | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;

  const encoded = hash.slice(7); // Remove '#share='
  return decodeLayoutFromURL(encoded);
}

/**
 * Clear the shared layout from URL (after import).
 */
export function clearSharedLayoutFromURL(): void {
  if (typeof window === 'undefined') return;

  // Remove the hash without triggering a page reload
  const url = window.location.href.split('#')[0];
  window.history.replaceState(null, '', url);
}

/**
 * Check if the current URL is a cloud share URL.
 * Returns the share ID if found, null otherwise.
 * Cloud share URLs have the format: /s/{12-char-alphanumeric}
 */
export function getCloudShareIdFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  // Check pathname for /s/{id} format
  const pathMatch = window.location.pathname.match(/^\/s\/([a-zA-Z0-9]{12})$/);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Also check hash for backwards compatibility (in case someone uses #/s/{id})
  const hashMatch = window.location.hash.match(/^#\/s\/([a-zA-Z0-9]{12})$/);
  if (hashMatch) {
    return hashMatch[1];
  }

  return null;
}

/**
 * Clear the cloud share ID from URL.
 */
export function clearCloudShareFromURL(): void {
  if (typeof window === 'undefined') return;

  // Navigate to root without page reload
  if (window.location.pathname.startsWith('/s/')) {
    window.history.replaceState(null, '', '/');
  }
}

/**
 * Download a layout as a JSON file.
 */
export function downloadLayoutAsFile(layout: Layout, filename?: string): void {
  const json = exportLayoutJSON(layout);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${layout.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard.
 * Returns true if successful.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Initialize the layout library system.
 * Handles migration from legacy storage if needed.
 * Returns the library and the active layout.
 */
export function initializeLayoutLibrary(): { library: LayoutLibrary; activeLayout: Layout } {
  // Try to load existing library
  let library = loadLibrary();

  if (!library) {
    // Check for legacy storage and migrate
    library = migrateFromLegacyStorage();
  }

  if (!library) {
    // Fresh start: create new library with default layout
    const layoutId = generateUUID();
    const defaultLayout: Layout = {
      version: '1.0',
      name: 'Untitled layout',
      drawer: { width: 10, depth: 8, height: 12 },
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
      categories: [
        { id: generateId(), name: 'Coral', color: '#f87171' },
        { id: generateId(), name: 'Sky', color: '#38bdf8' },
        { id: generateId(), name: 'Green', color: '#4ade80' },
        { id: generateId(), name: 'Cloud', color: '#e2e8f0' },
        { id: generateId(), name: 'Charcoal', color: '#334155' },
      ],
      layers: [
        { id: generateId(), name: 'Layer 1', height: 3 },
      ],
      bins: [],
    };

    library = {
      version: '1.0',
      activeLayoutId: layoutId,
      settings: {},
      entries: [{
        id: layoutId,
        name: defaultLayout.name,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: computeLayoutPreview(defaultLayout),
      }],
    };

    saveLayoutById(layoutId, defaultLayout);
    saveLibrary(library);
  }

  // Load the active layout
  let activeLayout = loadLayoutById(library.activeLayoutId);

  if (!activeLayout) {
    // Active layout is missing, try to recover
    console.warn(`Active layout ${library.activeLayoutId} not found, attempting recovery`);

    // Try loading any available layout
    for (const entry of library.entries) {
      activeLayout = loadLayoutById(entry.id);
      if (activeLayout) {
        library.activeLayoutId = entry.id;
        saveLibrary(library);
        break;
      }
    }

    // If still nothing, create a fresh default
    if (!activeLayout) {
      const layoutId = generateUUID();
      activeLayout = {
        version: '1.0',
        name: 'Recovered layout',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [
          { id: generateId(), name: 'Default', color: '#6b7280' },
        ],
        layers: [
          { id: generateId(), name: 'Layer 1', height: 3 },
        ],
        bins: [],
      };

      library.activeLayoutId = layoutId;
      library.entries = [{
        id: layoutId,
        name: activeLayout.name,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: computeLayoutPreview(activeLayout),
      }];

      saveLayoutById(layoutId, activeLayout);
      saveLibrary(library);
    }
  }

  return { library, activeLayout };
}

// === Collection Membership Storage ===

const COLLECTION_MEMBERSHIPS_KEY = 'gridfinity-collection-memberships-v1';

/**
 * Save collection memberships to localStorage.
 */
export function saveCollectionMemberships(memberships: CollectionMembership[]): void {
  try {
    localStorage.setItem(COLLECTION_MEMBERSHIPS_KEY, JSON.stringify(memberships));
  } catch (e) {
    console.error('Failed to save collection memberships:', e);
  }
}

/**
 * Load collection memberships from localStorage.
 */
export function loadCollectionMemberships(): CollectionMembership[] {
  try {
    const stored = localStorage.getItem(COLLECTION_MEMBERSHIPS_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);

    // Validate it's an array
    if (!Array.isArray(parsed)) return [];

    // Basic validation of each membership
    return parsed.filter((m): m is CollectionMembership =>
      typeof m === 'object' &&
      typeof m.collectionId === 'string' &&
      typeof m.collectionName === 'string' &&
      typeof m.joinedAt === 'number' &&
      typeof m.lastSyncAt === 'number' &&
      typeof m.lastAccessedAt === 'number'
    );
  } catch (e) {
    console.error('Failed to load collection memberships:', e);
    return [];
  }
}

/**
 * Clear all collection memberships from localStorage.
 */
export function clearCollectionMemberships(): void {
  localStorage.removeItem(COLLECTION_MEMBERSHIPS_KEY);
}
