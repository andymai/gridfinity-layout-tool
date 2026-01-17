import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDimension,
  buildSearchUrl,
  openSearchUrl,
  openSTLSearch,
  validateUrlTemplate,
} from '../../utils/stlSearch';
import type { STLSearchSite } from '../../core/store/settings';

describe('stlSearch utilities', () => {
  describe('formatDimension', () => {
    it('formats whole numbers without decimals', () => {
      expect(formatDimension(1)).toBe('1');
      expect(formatDimension(2)).toBe('2');
      expect(formatDimension(10)).toBe('10');
    });

    it('formats fractional numbers with one decimal place', () => {
      expect(formatDimension(1.5)).toBe('1.5');
      expect(formatDimension(2.5)).toBe('2.5');
      expect(formatDimension(0.5)).toBe('0.5');
    });

    it('formats numbers that end in .0 as integers', () => {
      expect(formatDimension(3.0)).toBe('3');
      expect(formatDimension(5.0)).toBe('5');
    });
  });

  describe('buildSearchUrl', () => {
    const testSite: STLSearchSite = {
      id: 'test',
      name: 'Test Site',
      urlTemplate: 'https://example.com/search?q=gridfinity+{width}x{depth}',
      enabled: true,
    };

    it('substitutes width and depth placeholders', () => {
      const url = buildSearchUrl(testSite, { width: 2, depth: 3 });
      expect(url).toBe('https://example.com/search?q=gridfinity+2x3');
    });

    it('handles fractional dimensions', () => {
      const url = buildSearchUrl(testSite, { width: 1.5, depth: 2.5 });
      expect(url).toBe('https://example.com/search?q=gridfinity+1.5x2.5');
    });

    it('handles multiple occurrences of same placeholder', () => {
      const site: STLSearchSite = {
        ...testSite,
        urlTemplate: 'https://example.com/search?w={width}&w2={width}&d={depth}',
      };
      const url = buildSearchUrl(site, { width: 2, depth: 3 });
      expect(url).toBe('https://example.com/search?w=2&w2=2&d=3');
    });

    it('handles URL-encoded placeholders', () => {
      const site: STLSearchSite = {
        ...testSite,
        urlTemplate: 'https://example.com/search/gridfinity%20{width}x{depth}',
      };
      const url = buildSearchUrl(site, { width: 1, depth: 1 });
      expect(url).toBe('https://example.com/search/gridfinity%201x1');
    });

    describe('needsSplit parameter', () => {
      it('replaces {width}x{depth} pattern with "split"', () => {
        const url = buildSearchUrl(testSite, { width: 8, depth: 8 }, true);
        expect(url).toBe('https://example.com/search?q=gridfinity+split');
      });

      it('replaces URL-encoded space variant with "split"', () => {
        const site: STLSearchSite = {
          ...testSite,
          urlTemplate: 'https://example.com/search?q=gridfinity+{width}%20{depth}',
        };
        const url = buildSearchUrl(site, { width: 8, depth: 8 }, true);
        expect(url).toBe('https://example.com/search?q=gridfinity+split');
      });

      it('replaces standalone {width} with "split" and removes {depth}', () => {
        const site: STLSearchSite = {
          ...testSite,
          urlTemplate: 'https://example.com/search?w={width}&d={depth}',
        };
        const url = buildSearchUrl(site, { width: 8, depth: 8 }, true);
        expect(url).toBe('https://example.com/search?w=split&d=');
      });

      it('uses normal dimensions when needsSplit is false', () => {
        const url = buildSearchUrl(testSite, { width: 2, depth: 3 }, false);
        expect(url).toBe('https://example.com/search?q=gridfinity+2x3');
      });

      it('uses normal dimensions when needsSplit is undefined', () => {
        const url = buildSearchUrl(testSite, { width: 2, depth: 3 });
        expect(url).toBe('https://example.com/search?q=gridfinity+2x3');
      });
    });
  });

  describe('openSearchUrl', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it('opens URL in new tab with security attributes', () => {
      openSearchUrl('https://example.com/search');
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://example.com/search',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('openSTLSearch', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it('builds URL and opens in new tab', () => {
      const site: STLSearchSite = {
        id: 'printables',
        name: 'Printables',
        urlTemplate: 'https://www.printables.com/search/models?q=gridfinity+{width}x{depth}',
        enabled: true,
      };

      openSTLSearch(site, { width: 2, depth: 3 });

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://www.printables.com/search/models?q=gridfinity+2x3',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('searches for "split" when needsSplit is true', () => {
      const site: STLSearchSite = {
        id: 'printables',
        name: 'Printables',
        urlTemplate: 'https://www.printables.com/search/models?q=gridfinity+{width}x{depth}',
        enabled: true,
      };

      openSTLSearch(site, { width: 8, depth: 8 }, true);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://www.printables.com/search/models?q=gridfinity+split',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('validateUrlTemplate', () => {
    it('returns null for valid template with width placeholder', () => {
      const result = validateUrlTemplate('https://example.com/search?q={width}');
      expect(result).toBeNull();
    });

    it('returns null for valid template with depth placeholder', () => {
      const result = validateUrlTemplate('https://example.com/search?q={depth}');
      expect(result).toBeNull();
    });

    it('returns null for valid template with both placeholders', () => {
      const result = validateUrlTemplate('https://example.com/search?q={width}x{depth}');
      expect(result).toBeNull();
    });

    it('returns error for empty template', () => {
      const result = validateUrlTemplate('');
      expect(result).toBe('URL template cannot be empty');
    });

    it('returns error for whitespace-only template', () => {
      const result = validateUrlTemplate('   ');
      expect(result).toBe('URL template cannot be empty');
    });

    it('returns error for template without placeholders', () => {
      const result = validateUrlTemplate('https://example.com/search');
      expect(result).toBe('URL template must include {width} or {depth} placeholder');
    });

    it('returns error for invalid URL', () => {
      const result = validateUrlTemplate('not-a-valid-url{width}');
      expect(result).toBe('URL template must be a valid URL');
    });
  });
});
