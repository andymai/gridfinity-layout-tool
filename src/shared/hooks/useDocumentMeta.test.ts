/**
 * Tests for useDocumentMeta hook and buildLayoutDescription helper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { LocaleProvider } from '@/i18n/context';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { resetAllStores, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { buildLayoutDescription, useDocumentMeta } from './useDocumentMeta';

// Helper: wrap hook in LocaleProvider
function createWrapper({ children }: { children: ReactNode }) {
  return createElement(LocaleProvider, { initialLocale: 'en' }, children);
}

/** Ensure all required meta tags exist in the test DOM */
function ensureMetaTags(): void {
  const tags = [
    { attr: 'name', value: 'description' },
    { attr: 'property', value: 'og:title' },
    { attr: 'property', value: 'og:description' },
    { attr: 'property', value: 'og:url' },
    { attr: 'name', value: 'twitter:title' },
    { attr: 'name', value: 'twitter:description' },
  ];

  for (const tag of tags) {
    const selector = `meta[${tag.attr}="${tag.value}"]`;
    if (!document.querySelector(selector)) {
      const meta = document.createElement('meta');
      meta.setAttribute(tag.attr, tag.value);
      meta.setAttribute('content', '');
      document.head.appendChild(meta);
    }
  }
}

describe('buildLayoutDescription', () => {
  it('builds description with layout data', () => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      if (key === 'seo.layoutDescription' && vars) {
        return `${vars.width}×${vars.depth} Gridfinity drawer layout with ${vars.binCount} bins across ${vars.layerCount} layers.`;
      }
      return key;
    };

    const result = buildLayoutDescription(t, 10, 8, 15, 2);
    expect(result).toBe('10×8 Gridfinity drawer layout with 15 bins across 2 layers.');
  });

  it('handles zero bins and single layer', () => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      if (key === 'seo.layoutDescription' && vars) {
        return `${vars.width}×${vars.depth} Gridfinity drawer layout with ${vars.binCount} bins across ${vars.layerCount} layers.`;
      }
      return key;
    };

    const result = buildLayoutDescription(t, 5, 5, 0, 1);
    expect(result).toBe('5×5 Gridfinity drawer layout with 0 bins across 1 layers.');
  });

  it('passes values as strings to translation function', () => {
    const receivedVars: Record<string, string | number> = {};
    const t = (key: string, vars?: Record<string, string | number>) => {
      if (vars) Object.assign(receivedVars, vars);
      return key;
    };

    buildLayoutDescription(t, 10, 8, 15, 2);
    expect(receivedVars.width).toBe('10');
    expect(receivedVars.depth).toBe('8');
    expect(receivedVars.binCount).toBe('15');
    expect(receivedVars.layerCount).toBe('2');
  });
});

describe('useDocumentMeta', () => {
  beforeEach(() => {
    resetAllStores();
    ensureMetaTags();
    document.title = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets layout-specific meta tags when layout has a name', () => {
    // Set up store with a named layout
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: 'My Workshop',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'General', color: '#3b82f6' }],
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 3 },
        ],
        bins: [
          createTestBin({ id: 'b1', layerId: 'layer1' }),
          createTestBin({ id: 'b2', layerId: 'layer1' }),
          createTestBin({ id: 'b3', layerId: 'layer2', x: 3 }),
        ],
      },
    });
    useLibraryStore.setState({
      library: {
        version: '1.0',
        activeLayoutId: 'test-layout-123',
        settings: {},
        entries: [],
      },
    });

    renderHook(() => useDocumentMeta(), { wrapper: createWrapper });

    expect(document.title).toBe('My Workshop | Gridfinity Layout Tool');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      '10×8'
    );
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      '3 bins'
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'My Workshop | Gridfinity Layout Tool'
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(
      'My Workshop | Gridfinity Layout Tool'
    );
  });

  it('excludes staging bins from count', () => {
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: 'With Staging',
        drawer: { width: 5, depth: 5, height: 10 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'General', color: '#3b82f6' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [
          createTestBin({ id: 'b1', layerId: 'layer1' }),
          createTestBin({ id: 'staged1', layerId: STAGING_ID }),
          createTestBin({ id: 'staged2', layerId: STAGING_ID }),
        ],
      },
    });
    useLibraryStore.setState({
      library: {
        version: '1.0',
        activeLayoutId: 'test-layout-123',
        settings: {},
        entries: [],
      },
    });

    renderHook(() => useDocumentMeta(), { wrapper: createWrapper });

    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content');
    expect(desc).toContain('1 bins');
  });

  it('restores default meta tags when layout name is empty', () => {
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: '',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'General', color: '#3b82f6' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
      },
    });
    useLibraryStore.setState({
      library: {
        version: '1.0',
        activeLayoutId: 'test-layout-123',
        settings: {},
        entries: [],
      },
    });

    renderHook(() => useDocumentMeta(), { wrapper: createWrapper });

    expect(document.title).toContain('Gridfinity Layout Tool | Plan Your');
  });

  it('truncates long layout names at 60 characters', () => {
    const longName = 'A'.repeat(80);
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: longName,
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'General', color: '#3b82f6' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
      },
    });
    useLibraryStore.setState({
      library: {
        version: '1.0',
        activeLayoutId: 'test-layout-123',
        settings: {},
        entries: [],
      },
    });

    renderHook(() => useDocumentMeta(), { wrapper: createWrapper });

    // Title should contain truncated name (60 chars) not full 80
    expect(document.title).toBe('A'.repeat(60) + ' | Gridfinity Layout Tool');
  });

  it('restores defaults on unmount', () => {
    useLayoutStore.setState({
      layout: {
        version: '1.0',
        name: 'My Layout',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: 'cat1', name: 'General', color: '#3b82f6' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
      },
    });
    useLibraryStore.setState({
      library: {
        version: '1.0',
        activeLayoutId: 'test-layout-123',
        settings: {},
        entries: [],
      },
    });

    const { unmount } = renderHook(() => useDocumentMeta(), { wrapper: createWrapper });

    expect(document.title).toBe('My Layout | Gridfinity Layout Tool');

    unmount();

    // After unmount, defaults should be restored
    expect(document.title).toContain('Gridfinity Layout Tool | Plan Your');
  });
});
