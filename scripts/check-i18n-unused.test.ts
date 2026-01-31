import { describe, expect, it } from 'vitest';

import {
  type KeyUsage,
  type UnusedKeyReport,
  classifyUnusedKeys,
  extractKeyReferences,
  extractKeysFromSource,
} from './check-i18n-unused';

describe('extractKeysFromSource', () => {
  it('extracts single-quoted keys', () => {
    const content = `const en = {\n  'common.save': 'Save',\n  'common.cancel': 'Cancel',\n};`;
    expect(extractKeysFromSource(content)).toEqual(['common.cancel', 'common.save']);
  });

  it('extracts double-quoted values', () => {
    const content = `const en = {\n  'seo.title': "My App",\n};`;
    expect(extractKeysFromSource(content)).toEqual(['seo.title']);
  });

  it('handles multiline values', () => {
    const content = `const en = {\n  'long.key':\n    'Some long value',\n};`;
    expect(extractKeysFromSource(content)).toEqual(['long.key']);
  });

  it('returns empty array for content with no keys', () => {
    expect(extractKeysFromSource('export default {};')).toEqual([]);
  });
});

describe('extractKeyReferences', () => {
  it('finds literal t() calls with single quotes', () => {
    const content = `const x = t('common.save');`;
    const usage = extractKeyReferences(content);
    expect(usage.literalKeys).toContain('common.save');
  });

  it('finds literal t() calls with double quotes', () => {
    const content = `const x = t("common.cancel");`;
    const usage = extractKeyReferences(content);
    expect(usage.literalKeys).toContain('common.cancel');
  });

  it('finds getStaticTranslation() calls', () => {
    const content = `getStaticTranslation('errorBoundary.heading')`;
    const usage = extractKeyReferences(content);
    expect(usage.literalKeys).toContain('errorBoundary.heading');
  });

  it('extracts dynamic prefixes from template literals', () => {
    const content = 't(`nameSuggestion.source.${primarySuggestion.source}`)';
    const usage = extractKeyReferences(content);
    expect(usage.dynamicPrefixes).toContain('nameSuggestion.source.');
  });

  it('extracts multiple dynamic prefixes', () => {
    const content = [
      't(`binDesigner.wallThickness.${value}`)',
      't(`binDesigner.alignment.${option}`)',
    ].join('\n');
    const usage = extractKeyReferences(content);
    expect(usage.dynamicPrefixes).toContain('binDesigner.wallThickness.');
    expect(usage.dynamicPrefixes).toContain('binDesigner.alignment.');
  });

  it('handles mixed literal and dynamic calls', () => {
    const content = ["t('common.save')", 't(`prefix.${var}`)'].join('\n');
    const usage = extractKeyReferences(content);
    expect(usage.literalKeys).toContain('common.save');
    expect(usage.dynamicPrefixes).toContain('prefix.');
  });

  it('does not match non-translation t calls', () => {
    const content = `const result = event('click');`;
    const usage = extractKeyReferences(content);
    expect(usage.literalKeys.size).toBe(0);
  });

  it('returns empty sets for content without translations', () => {
    const content = 'const x = 42;';
    const usage = extractKeyReferences(content);
    expect(usage.literalKeys.size).toBe(0);
    expect(usage.dynamicPrefixes.size).toBe(0);
  });

  it('finds keys stored in data structures when knownKeys provided', () => {
    const content = `const COMMANDS = [{ labelKey: 'commandPalette.openSettings' }];`;
    const knownKeys = new Set(['commandPalette.openSettings', 'common.save']);
    const usage = extractKeyReferences(content, knownKeys);
    expect(usage.literalKeys).toContain('commandPalette.openSettings');
  });

  it('finds keys in array constants with as const', () => {
    const content = `const TIPS = ['help.tip.binPalette', 'help.tip.autoSplit'] as const;`;
    const knownKeys = new Set(['help.tip.binPalette', 'help.tip.autoSplit']);
    const usage = extractKeyReferences(content, knownKeys);
    expect(usage.literalKeys).toContain('help.tip.binPalette');
    expect(usage.literalKeys).toContain('help.tip.autoSplit');
  });

  it('finds keys in Record-type maps', () => {
    const content = `const SORT: Record<Field, string> = { layer: 'print.sort.field.layer' };`;
    const knownKeys = new Set(['print.sort.field.layer']);
    const usage = extractKeyReferences(content, knownKeys);
    expect(usage.literalKeys).toContain('print.sort.field.layer');
  });

  it('ignores dot-notation strings that are not known keys', () => {
    const content = `import { something } from '@/core/utils';`;
    const knownKeys = new Set(['common.save']);
    const usage = extractKeyReferences(content, knownKeys);
    expect(usage.literalKeys.size).toBe(0);
  });

  it('works without knownKeys (backward compatible)', () => {
    const content = `const COMMANDS = [{ labelKey: 'commandPalette.openSettings' }];`;
    const usage = extractKeyReferences(content);
    // Without knownKeys, data-structure keys are not detected
    expect(usage.literalKeys.size).toBe(0);
  });
});

describe('classifyUnusedKeys', () => {
  it('marks referenced keys as used', () => {
    const allKeys = ['common.save', 'common.cancel'];
    const usage: KeyUsage = {
      literalKeys: new Set(['common.save', 'common.cancel']),
      dynamicPrefixes: new Set(),
    };
    const report = classifyUnusedKeys(allKeys, usage);
    expect(report.definitelyUnused).toEqual([]);
    expect(report.possiblyUnused).toEqual([]);
  });

  it('marks unreferenced keys as definitely unused', () => {
    const allKeys = ['common.save', 'orphan.key'];
    const usage: KeyUsage = {
      literalKeys: new Set(['common.save']),
      dynamicPrefixes: new Set(),
    };
    const report = classifyUnusedKeys(allKeys, usage);
    expect(report.definitelyUnused).toEqual(['orphan.key']);
    expect(report.possiblyUnused).toEqual([]);
  });

  it('marks dynamic-prefix-covered keys as possibly unused', () => {
    const allKeys = ['prefix.a', 'prefix.b', 'other.key'];
    const usage: KeyUsage = {
      literalKeys: new Set(),
      dynamicPrefixes: new Set(['prefix.']),
    };
    const report: UnusedKeyReport = classifyUnusedKeys(allKeys, usage);
    expect(report.possiblyUnused).toEqual(['prefix.a', 'prefix.b']);
    expect(report.definitelyUnused).toEqual(['other.key']);
  });

  it('prefers literal match over dynamic prefix', () => {
    const allKeys = ['prefix.a'];
    const usage: KeyUsage = {
      literalKeys: new Set(['prefix.a']),
      dynamicPrefixes: new Set(['prefix.']),
    };
    const report = classifyUnusedKeys(allKeys, usage);
    expect(report.definitelyUnused).toEqual([]);
    expect(report.possiblyUnused).toEqual([]);
  });

  it('handles empty key list', () => {
    const usage: KeyUsage = {
      literalKeys: new Set(['common.save']),
      dynamicPrefixes: new Set(),
    };
    const report = classifyUnusedKeys([], usage);
    expect(report.definitelyUnused).toEqual([]);
    expect(report.possiblyUnused).toEqual([]);
  });
});
