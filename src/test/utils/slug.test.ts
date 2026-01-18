import { describe, it, expect } from 'vitest';
import { slugify, buildLayoutPath } from '@/utils/slug';

describe('slug utilities', () => {
  describe('slugify', () => {
    describe('basic transformations', () => {
      it('converts to lowercase', () => {
        expect(slugify('Hello World')).toBe('hello-world');
        expect(slugify('UPPERCASE')).toBe('uppercase');
        expect(slugify('MixedCase')).toBe('mixedcase');
      });

      it('converts spaces to hyphens', () => {
        expect(slugify('hello world')).toBe('hello-world');
        expect(slugify('multiple   spaces')).toBe('multiple-spaces');
      });

      it('converts underscores to hyphens', () => {
        expect(slugify('hello_world')).toBe('hello-world');
        expect(slugify('multiple__underscores')).toBe('multiple-underscores');
      });

      it('removes special characters', () => {
        expect(slugify('hello@world!')).toBe('helloworld');
        expect(slugify('test#123$')).toBe('test123');
        expect(slugify('name (with) [brackets]')).toBe('name-with-brackets');
      });

      it('keeps numbers', () => {
        expect(slugify('item 1')).toBe('item-1');
        expect(slugify('drawer #3')).toBe('drawer-3');
        expect(slugify('2024 layout')).toBe('2024-layout');
      });

      it('preserves hyphens', () => {
        expect(slugify('already-hyphenated')).toBe('already-hyphenated');
        expect(slugify('pre-existing-slug')).toBe('pre-existing-slug');
      });
    });

    describe('hyphen normalization', () => {
      it('collapses multiple hyphens', () => {
        expect(slugify('hello--world')).toBe('hello-world');
        expect(slugify('many---hyphens----here')).toBe('many-hyphens-here');
      });

      it('trims leading hyphens', () => {
        expect(slugify('-leading')).toBe('leading');
        expect(slugify('---multiple-leading')).toBe('multiple-leading');
      });

      it('trims trailing hyphens', () => {
        expect(slugify('trailing-')).toBe('trailing');
        expect(slugify('multiple-trailing---')).toBe('multiple-trailing');
      });

      it('trims both leading and trailing hyphens', () => {
        expect(slugify('-both-ends-')).toBe('both-ends');
        expect(slugify('---padded---')).toBe('padded');
      });
    });

    describe('whitespace handling', () => {
      it('trims leading/trailing whitespace', () => {
        expect(slugify('  padded  ')).toBe('padded');
        expect(slugify('\ttabbed\t')).toBe('tabbed');
        expect(slugify('\n  newlines  \n')).toBe('newlines');
      });

      it('handles mixed whitespace', () => {
        expect(slugify('  --Hello World--  ')).toBe('hello-world');
      });
    });

    describe('empty and edge cases', () => {
      it('returns "layout" for empty string', () => {
        expect(slugify('')).toBe('layout');
      });

      it('returns "layout" for whitespace-only', () => {
        expect(slugify('   ')).toBe('layout');
        expect(slugify('\t\n')).toBe('layout');
      });

      it('returns "layout" for special-chars-only', () => {
        expect(slugify('!@#$%^&*()')).toBe('layout');
        expect(slugify('---')).toBe('layout');
      });
    });

    describe('truncation', () => {
      const MAX_LENGTH = 50;

      it('does not truncate short slugs', () => {
        const shortName = 'short-name';
        expect(slugify(shortName)).toBe('short-name');
        expect(slugify(shortName).length).toBeLessThanOrEqual(MAX_LENGTH);
      });

      it('truncates long slugs to max length', () => {
        const longName = 'this is a very long layout name that exceeds the maximum allowed slug length';
        const result = slugify(longName);
        expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);
      });

      it('truncates at word boundary when possible', () => {
        // Create a name that would exceed 50 chars
        const longName = 'my super awesome kitchen drawer organizer for tools and gadgets';
        const result = slugify(longName);

        expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);
        // Should not end with partial word - should end cleanly
        expect(result.endsWith('-')).toBe(false);
      });

      it('truncates at exact position if no good word boundary', () => {
        // Create a slug with no hyphens in the second half
        const noHyphenName = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';
        const result = slugify(noHyphenName);

        expect(result.length).toBe(MAX_LENGTH);
      });

      it('preserves meaning when truncating', () => {
        const longName = 'garage-workshop-tool-storage-drawer-layout-version-two-final';
        const result = slugify(longName);

        expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);
        // Should start with recognizable prefix
        expect(result.startsWith('garage-workshop')).toBe(true);
      });
    });

    describe('real-world examples', () => {
      it('handles typical layout names', () => {
        expect(slugify('My Workshop Layout')).toBe('my-workshop-layout');
        expect(slugify('Garage Tool Drawer #1')).toBe('garage-tool-drawer-1');
        expect(slugify('Kitchen Utensils')).toBe('kitchen-utensils');
        expect(slugify('Office Supplies (main desk)')).toBe('office-supplies-main-desk');
      });

      it('handles unicode and special characters', () => {
        expect(slugify('Küchenschublade')).toBe('kchenschublade');
        expect(slugify('抽屉布局')).toBe('layout'); // Non-latin chars removed
        expect(slugify('Layout 日本語')).toBe('layout');
      });
    });
  });

  describe('buildLayoutPath', () => {
    it('builds correct path with ID and name', () => {
      expect(buildLayoutPath('abc123', 'My Layout')).toBe('/l/abc123/my-layout');
    });

    it('slugifies the layout name', () => {
      expect(buildLayoutPath('id123', 'Hello World Layout')).toBe('/l/id123/hello-world-layout');
    });

    it('handles special characters in name', () => {
      expect(buildLayoutPath('xyz789', 'Layout #1 (test)')).toBe('/l/xyz789/layout-1-test');
    });

    it('uses default slug for empty name', () => {
      expect(buildLayoutPath('id456', '')).toBe('/l/id456/layout');
    });

    it('handles typical share URLs', () => {
      const result = buildLayoutPath('abc123xyz789', 'My Workshop Drawer');
      expect(result).toBe('/l/abc123xyz789/my-workshop-drawer');
    });
  });
});
