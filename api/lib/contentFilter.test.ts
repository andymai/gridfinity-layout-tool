/**
 * Tests for content filter module.
 */

import { describe, it, expect } from 'vitest';
import { filterLayoutContent } from '../../api/lib/contentFilter';

describe('filterLayoutContent', () => {
  describe('clean content', () => {
    it('passes layout with normal text', () => {
      const result = filterLayoutContent({
        name: 'My Drawer Layout',
        bins: [
          { label: 'Screws', notes: 'For woodworking projects' },
          { label: 'Nails', notes: '2 inch and 3 inch sizes' },
        ],
        categories: [{ name: 'Hardware' }, { name: 'Tools' }],
      });

      expect(result.passed).toBe(true);
    });

    it('passes layout with empty strings', () => {
      const result = filterLayoutContent({
        name: 'Untitled',
        bins: [{ label: '', notes: '' }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(true);
    });

    it('passes layout with numbers and special characters', () => {
      const result = filterLayoutContent({
        name: 'Layout #1 (2024)',
        bins: [{ label: 'M3x10mm', notes: 'Qty: 100+' }],
        categories: [{ name: 'Bolts & Screws' }],
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('offensive content in layout name', () => {
    it('blocks layouts with slurs in name', () => {
      const result = filterLayoutContent({
        name: 'Test nigger layout',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Layout name');
    });

    it('blocks layouts with hate speech in name', () => {
      const result = filterLayoutContent({
        name: 'faggot drawer',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('offensive content in bin labels', () => {
    it('blocks bins with slurs in label', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: 'retard stuff', notes: '' }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Bin label');
    });
  });

  describe('offensive content in bin notes', () => {
    it('blocks bins with slurs in notes', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: 'Tools', notes: 'This is some cunt text' }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Bin notes');
    });
  });

  describe('offensive content in categories', () => {
    it('blocks categories with slurs', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [],
        categories: [{ name: 'spic stuff' }],
      });

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Category');
    });
  });

  describe('harmful patterns', () => {
    it('blocks potential XSS in script tags', () => {
      const result = filterLayoutContent({
        name: '<script>alert("xss")</script>',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks javascript: protocol', () => {
      const result = filterLayoutContent({
        name: 'javascript:void(0)',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks event handlers', () => {
      const result = filterLayoutContent({
        name: 'onclick = alert(1)',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks URLs (potential phishing)', () => {
      const result = filterLayoutContent({
        name: 'Check out https://malicious-site.com',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks repeated character spam', () => {
      const result = filterLayoutContent({
        name: 'aaaaaaaaaaaaaaaaaaaaaaaaa', // 25 a's
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('blocks Zalgo text', () => {
      const result = filterLayoutContent({
        name: 'H̸̡̧̛̛̛̛̛̛e̸l̸l̸o̸', // Zalgo text with many combining chars
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles undefined label and notes', () => {
      const result = filterLayoutContent({
        name: 'My Layout',
        bins: [{ label: undefined, notes: undefined }],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(true);
    });

    it('is case-insensitive for blocklist', () => {
      const result = filterLayoutContent({
        name: 'NIGGER',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });

    it('detects blocklist words with surrounding text', () => {
      const result = filterLayoutContent({
        name: 'This contains faggot in the middle',
        bins: [],
        categories: [{ name: 'Default' }],
      });

      expect(result.passed).toBe(false);
    });
  });
});
