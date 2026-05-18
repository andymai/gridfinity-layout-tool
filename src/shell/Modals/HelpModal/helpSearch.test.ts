import { describe, it, expect } from 'vitest';
import { searchHelpEntries } from './helpSearch';
import type { HelpEntry } from '@/shared/help/helpEntry';

const entries: HelpEntry[] = [
  {
    id: 'feature/grid-editor/print-bed-size',
    kind: 'feature',
    titleKey: 'title.printBedSize',
    descriptionKey: 'description.printBedSize',
    keywordsKey: 'keywords.printBedSize',
    target: { surface: 'sidebar:physical-units', controlId: 'print-bed-size' },
  },
  {
    id: 'feature/shell/half-bin-mode',
    kind: 'feature',
    titleKey: 'title.halfBin',
    descriptionKey: 'description.halfBin',
    keywordsKey: 'keywords.halfBin',
    target: { surface: 'sidebar:grid-size', controlId: 'half-bin-mode' },
  },
  {
    id: 'shortcut/general/0',
    kind: 'shortcut',
    titleKey: 'shortcut.undo',
    descriptionKey: 'shortcut.undo',
    keys: 'Z',
    modifier: true,
  },
];

const translations: Record<string, string> = {
  'title.printBedSize': 'Print bed size',
  'description.printBedSize': 'Width and depth of the printer bed.',
  'keywords.printBedSize': 'bed|bed size|print bed|printer size|build plate',
  'title.halfBin': 'Half-bin mode',
  'description.halfBin': 'Enable half-unit grid increments.',
  'keywords.halfBin': 'half|half-bin|0.5|fractional',
  'shortcut.undo': 'Undo last change',
};

const t = (key: string) => translations[key] ?? key;

describe('searchHelpEntries', () => {
  it('returns empty array for an empty query', () => {
    expect(searchHelpEntries(entries, '', t)).toEqual([]);
    expect(searchHelpEntries(entries, '   ', t)).toEqual([]);
  });

  it('matches a synonym via keywords (the reported "bed size" case)', () => {
    const results = searchHelpEntries(entries, 'bed size', t);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('feature/grid-editor/print-bed-size');
  });

  it('matches a single-token query against keywords', () => {
    const results = searchHelpEntries(entries, 'bed', t);
    expect(results[0].entry.id).toBe('feature/grid-editor/print-bed-size');
  });

  it('respects word boundaries — "bed" should not match "embedded"', () => {
    const trickyEntries: HelpEntry[] = [
      {
        id: 'tip/embedded',
        kind: 'tip',
        titleKey: 'tip.embedded',
        descriptionKey: 'tip.embedded',
      },
    ];
    const localT = (key: string) =>
      key === 'tip.embedded' ? 'The embedded preview is interactive' : key;
    expect(searchHelpEntries(trickyEntries, 'bed', localT)).toEqual([]);
  });

  it('ranks title hits higher than description-only hits', () => {
    const localEntries: HelpEntry[] = [
      {
        id: 'feature/a',
        kind: 'tip',
        titleKey: 'a.title',
        descriptionKey: 'a.description',
      },
      {
        id: 'feature/b',
        kind: 'tip',
        titleKey: 'b.title',
        descriptionKey: 'b.description',
      },
    ];
    const localT = (key: string) => {
      const map: Record<string, string> = {
        'a.title': 'Print bed',
        'a.description': 'unrelated',
        'b.title': 'Other setting',
        'b.description': 'The print bed size is configurable here',
      };
      return map[key] ?? key;
    };
    const results = searchHelpEntries(localEntries, 'print bed', localT);
    expect(results[0].entry.id).toBe('feature/a');
  });

  it('requires every query token to match somewhere', () => {
    // "bed" matches; "xylophone" matches nothing — entry must be excluded.
    expect(searchHelpEntries(entries, 'bed xylophone', t)).toEqual([]);
  });

  it('supports prefix matching with at least 2 chars', () => {
    expect(searchHelpEntries(entries, 'frac', t)[0].entry.id).toBe('feature/shell/half-bin-mode');
  });

  it('falls back to id-path tokens for English queries with no translation hit', () => {
    const localT = (_key: string) => '';
    const results = searchHelpEntries(entries, 'half bin', localT);
    expect(results[0].entry.id).toBe('feature/shell/half-bin-mode');
  });

  it('matches shortcut entries by their key sequence (e.g. typing "z" finds Undo)', () => {
    const results = searchHelpEntries(entries, 'z', t);
    expect(results.some((r) => r.entry.id === 'shortcut/general/0')).toBe(true);
  });
});
