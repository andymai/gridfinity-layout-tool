import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en';
import { LAYOUT_LABEL_TARGETS, findLabelTarget, layoutLabelTargets } from './labelTargets';
import type { LabelTarget } from './labelTargets';

const LOCALES = path.resolve(__dirname, '../../i18n/locales');
const english = (key: string): readonly (string | undefined)[] => [en[key]];

describe('findLabelTarget', () => {
  const targets = layoutLabelTargets();

  it('finds the control that a label names in the layout editor', () => {
    expect(findLabelTarget('Half-grid mode', targets, english)).toEqual({
      surface: 'sidebar:grid-size',
      controlId: 'half-bin-mode',
    });
    expect(findLabelTarget('  layers ', targets, english)?.controlId).toBe('layers-panel');
    expect(findLabelTarget('Print bed', targets, english)?.controlId).toBe('print-bed-size');
  });

  it('names nothing for a label without a target, such as the cutout editor’s fit test', () => {
    expect(findLabelTarget('Print fit test', targets, english)).toBeNull();
    expect(findLabelTarget('', targets, english)).toBeNull();
  });

  it('names nothing when two targets share the text', () => {
    const two: LabelTarget[] = [
      { key: 'a', target: { surface: 's', controlId: 'one' } },
      { key: 'b', target: { surface: 's', controlId: 'two' } },
    ];
    expect(findLabelTarget('Same', two, () => ['Same'])).toBeNull();
  });

  it('uses only keys that exist, so a renamed key cannot leave a dead entry', () => {
    for (const key of Object.keys(LAYOUT_LABEL_TARGETS)) expect(en[key], key).toBeDefined();
  });

  // A label that two targets share in a locale would never show; this keeps
  // every mapped label unique in every language the app ships.
  it('gives each mapped label one target in every locale', () => {
    const files = fs.readdirSync(LOCALES).filter((file) => file.endsWith('.json'));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const strings = JSON.parse(fs.readFileSync(path.join(LOCALES, file), 'utf8')) as Record<
        string,
        string
      >;
      for (const { key } of targets) {
        const text = strings[key] ?? en[key];
        if (text === undefined) continue;
        expect(
          findLabelTarget(text, targets, (k) => [strings[k] ?? en[k]]),
          `${file}: ${key}`
        ).not.toBeNull();
      }
    }
  });
});
