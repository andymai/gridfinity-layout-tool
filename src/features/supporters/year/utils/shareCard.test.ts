import { describe, expect, it } from 'vitest';
import type { ShareSpec } from '../components/YearCardView/shareSpec';
import { drawShareCard, type ShareTheme } from './shareCard';

interface Drawn {
  readonly text: string;
  readonly baseline: string;
  readonly font: string;
}

function recordingContext(): { ctx: CanvasRenderingContext2D; drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  const keys = [
    'textBaseline',
    'textAlign',
    'font',
    'fillStyle',
    'shadowBlur',
    'globalAlpha',
  ] as const;
  const stack: Record<string, unknown>[] = [];
  const state: Record<string, unknown> = { textBaseline: 'alphabetic', font: '' };
  const gradient = { addColorStop: () => undefined };
  const noop = (): void => undefined;
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'save')
        return () => stack.push(Object.fromEntries(keys.map((k) => [k, target[k]])));
      if (key === 'restore') return () => Object.assign(target, stack.pop());
      if (key === 'fillText')
        return (text: string) =>
          drawn.push({ text, baseline: String(target.textBaseline), font: String(target.font) });
      if (key === 'measureText') return (text: string) => ({ width: text.length * 40 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (typeof key === 'string' && key in target) return target[key];
      return noop;
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, drawn };
}

const theme: ShareTheme = {
  accent: '#f59e0b',
  accentText: '#f59e0b',
  appFont: 'Inter',
  pixelFont: '"Press Start 2P"',
  kicker: 'Your 2026',
  site: 'gridfinitylayouttool.com',
};

describe('drawShareCard', () => {
  it('sets the title on the alphabetic baseline after a big-number visual', () => {
    const { ctx, drawn } = recordingContext();
    const spec: ShareSpec = {
      title: '148 bins placed.',
      lines: [],
      visual: { kind: 'big', text: '148' },
    };
    drawShareCard(ctx, spec, theme, {});
    expect(drawn.find((each) => each.text === '148 bins placed.')?.baseline).toBe('alphabetic');
  });

  it('keeps a very long design name to three title lines', () => {
    const { ctx, drawn } = recordingContext();
    const spec: ShareSpec = {
      title: 'Most complicated: ' + 'Very long imported design name '.repeat(12),
      lines: [],
      visual: { kind: 'glyph' },
    };
    drawShareCard(ctx, spec, theme, {});
    const title = drawn.filter((each) => each.font.startsWith('700 84px'));
    expect(title).toHaveLength(3);
    expect(title.at(-1)?.text.endsWith('…')).toBe(true);
  });
});
