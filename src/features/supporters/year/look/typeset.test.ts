import { describe, expect, it } from 'vitest';
import { roughMeasure } from '../cards/sceneFixtures.testUtils';
import { breakUnits, fitSize, roleFont, setText, wrapBalanced, type FontSpec } from './typeset';

const title = roleFont('title', 'en');
const line: FontSpec = { ...roleFont('line', 'en'), size: 10, lineHeight: 12 };

describe('wrapBalanced', () => {
  it('keeps a short text on one line', () => {
    expect(wrapBalanced('Your year', 960, title, roughMeasure, 'en')).toEqual(['Your year']);
  });

  it('evens out two lines instead of leaving a short last word', () => {
    const lines = wrapBalanced('aaaa bbbb cccc dddd eeee', 100, line, roughMeasure, 'en');
    expect(lines).toHaveLength(2);
    const widths = lines.map((each) => roughMeasure(each, line));
    expect(Math.abs((widths[0] ?? 0) - (widths[1] ?? 0))).toBeLessThanOrEqual(30);
  });

  it('never breaks a word to balance the lines', () => {
    const lines = wrapBalanced('Schubladenfläche, sortiert', 90, line, roughMeasure, 'de');
    expect(lines).toContain('Schubladenfläche,');
  });

  it('breaks Japanese between words and keeps a particle with its word', () => {
    const units = breakUnits('50人のおかげで、1年中ずっと無料でした。', 'ja');
    expect(units.some((unit) => unit.startsWith('で'))).toBe(false);
    expect(units.join('')).toBe('50人のおかげで、1年中ずっと無料でした。');
  });
});

describe('setText', () => {
  it('shrinks a block until its longest word fits, rather than break it', () => {
    const set = setText('Schubladenflächen', 960, title, roughMeasure, 'de', 3);
    expect(set.lines).toEqual(['Schubladenflächen']);
    expect(set.font.size).toBeLessThan(title.size);
    expect(roughMeasure(set.lines[0] ?? '', set.font)).toBeLessThanOrEqual(960);
  });

  it('shrinks to fit the line limit before it cuts', () => {
    const text = 'one two three four five six seven eight nine ten';
    const set = setText(text, 960, title, roughMeasure, 'en', 2);
    expect(set.lines.length).toBeLessThanOrEqual(2);
    expect(set.lines.join(' ')).toBe(text);
  });

  it('cuts with an ellipsis only past the smallest size', () => {
    const set = setText('word '.repeat(80), 400, title, roughMeasure, 'en', 2);
    expect(set.lines).toHaveLength(2);
    expect(set.lines.at(-1)?.endsWith('…')).toBe(true);
    expect(set.font.size).toBeGreaterThanOrEqual(title.size * 0.6 - 0.01);
  });
});

describe('fitSize', () => {
  it('fills the width just under it, and never passes the cap', () => {
    const size = fitSize('October', 960, title, roughMeasure, 1000);
    expect(roughMeasure('October', { ...title, size })).toBeLessThan(960);
    expect(roughMeasure('October', { ...title, size })).toBeGreaterThan(940);
    expect(fitSize('May', 960, title, roughMeasure, 330)).toBe(330);
  });
});
