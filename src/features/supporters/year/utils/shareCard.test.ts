import { describe, expect, it, vi } from 'vitest';
import { buildScene } from '../cards/buildScene';
import { sceneInput } from '../cards/sceneFixtures.testUtils';
import { SHARE_HEIGHT, SHARE_WIDTH, drawShareCard, type ShareTheme } from './shareCard';

interface Drawn {
  readonly text: string;
  readonly font: string;
  readonly fill: string;
}

function recordingContext(): { ctx: CanvasRenderingContext2D; drawn: Drawn[]; fills: string[] } {
  const drawn: Drawn[] = [];
  const fills: string[] = [];
  const state: Record<string, unknown> = { font: '', fillStyle: '' };
  const noop = (): void => undefined;
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'fillText')
        return (text: string) =>
          drawn.push({ text, font: String(target.font), fill: String(target.fillStyle) });
      if (key === 'fillRect' || key === 'fill') return () => fills.push(String(target.fillStyle));
      if (key === 'measureText')
        return (text: string) => ({
          width: text.length * 40,
          fontBoundingBoxAscent: 80,
          fontBoundingBoxDescent: 20,
          actualBoundingBoxAscent: 70,
          actualBoundingBoxDescent: 0,
        });
      if (key === 'getTransform') return () => ({ a: 1, d: 1 });
      if (typeof key === 'string' && key in target) return target[key];
      return noop;
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, drawn, fills };
}

const theme: ShareTheme = {
  kicker: 'Your 2026',
  locale: 'en',
  keys: ['Roll the credits', 'Support on Ko-fi'],
};

describe('drawShareCard', () => {
  it('is the 9:16 card', () => {
    expect(SHARE_WIDTH / SHARE_HEIGHT).toBeCloseTo(9 / 16);
  });

  it("fills the card's colour, then sets its copy where the card does", () => {
    const scene = buildScene(sceneInput('bins'));
    if (!scene) throw new Error('no scene');
    const { ctx, drawn, fills } = recordingContext();
    drawShareCard(ctx, scene, theme, {});
    expect(fills[0]).toBe('#2EE6A8');
    expect(drawn.map((each) => each.text)).toEqual(
      expect.arrayContaining(['148 bins placed.', 'gridfinitylayouttool.com', 'Your 2026'])
    );
    expect(drawn.find((each) => each.text === '148 bins placed.')?.fill).toBe('#053B26');
  });

  it('draws the scene at its settled frame', () => {
    const scene = buildScene(sceneInput('drawers'));
    if (!scene) throw new Error('no scene');
    const draw = vi.spyOn(scene, 'draw');
    drawShareCard(recordingContext().ctx, scene, theme, {});
    expect(draw.mock.calls[0]?.[0].t).toBeGreaterThan(scene.still);
    expect(draw.mock.calls[0]?.[0].reduced).toBe(false);
  });

  it('draws the bin the card shows when there is no 3D canvas and no thumbnail', () => {
    const scene = buildScene(sceneInput('complicated'));
    if (!scene?.model) throw new Error('no model slot');
    const { ctx, fills } = recordingContext();
    drawShareCard(ctx, scene, theme, {});
    expect(fills).toContain(scene.model.look.tint);
    expect(fills).toContain(scene.model.look.edge);
  });

  it("draws the thank-you card's keys with their labels", () => {
    const scene = buildScene(sceneInput('thanks'));
    if (!scene) throw new Error('no scene');
    const { ctx, drawn } = recordingContext();
    drawShareCard(ctx, scene, theme, {});
    expect(drawn.map((each) => each.text)).toEqual(
      expect.arrayContaining(['Roll the credits', 'Support on Ko-fi'])
    );
  });
});
