import {
  LID_TIP_SEGMENT_SECONDS,
  LID_TIP_SEGMENTS,
} from '../../src/features/bin-designer/data/featureTips/timing';
import type { LidAttachment } from '../../src/features/bin-designer/types/lid';
import { FPS } from './encode';
import { CLIP_CAMERA, lerpView } from './stage';
import type { Bounds, ParamOverrides, Stage, ThemeFrames, View } from './stage';

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function ramp(n: number, from: number, to: number): number[] {
  return Array.from({ length: n }, (_, i) => from + (to - from) * easeInOut((i + 1) / n));
}

const hold = <T>(frames: number, value: T): T[] => Array.from({ length: frames }, () => value);

export interface TipContext {
  stage: Stage;
  /** The dev server, for tips that drive the designer itself. */
  base: string;
}

export interface Clip {
  frames: ThemeFrames[];
  /** The frame that shows the feature's payoff: the poster, seen before the clip plays. */
  poster: number;
}

export interface Tip {
  id: string;
  /** The feature's colour in the launch sizzle, from the app's preview palette. */
  color: string;
  capture(ctx: TipContext): Promise<Clip>;
}

async function renderRun(
  stage: Stage,
  view: View,
  steps: readonly { params: ParamOverrides; lid?: number }[]
): Promise<ThemeFrames[]> {
  const frames: ThemeFrames[] = [];
  let built = '';
  for (const step of steps) {
    const key = JSON.stringify(step.params);
    if (key !== built) {
      await stage.setParams(step.params);
      built = key;
    }
    if (step.lid !== undefined) await stage.setLidOffset(step.lid);
    frames.push(await stage.render(view));
  }
  return frames;
}

const COMPARTMENTS = { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] };

const scoops: Tip = {
  id: 'scoops',
  color: '#2dd4bf',
  async capture({ stage }) {
    stage.setTint(this.color);
    const base = { width: 2, depth: 2, height: 4, compartments: COMPARTMENTS };
    const scoop = (radius: number): ParamOverrides => ({
      ...base,
      scoop: { enabled: true, radius, style: 'curved', side: 'front' },
    });
    // The scoop rises up the front wall's inner face, which faces away from a
    // front camera, so this one clip looks from the back at the same height.
    await stage.setParams(scoop(25));
    const view = await stage.fit(
      { ...CLIP_CAMERA, az: CLIP_CAMERA.az + 180 },
      await stage.bounds()
    );
    const grow = ramp(30, 5, 25).map((r) => ({ params: scoop(Math.round(r * 2) / 2) }));
    // Long holds on the plain bin and the full scoop, so it reads as before and after.
    const before = 21;
    const after = 30;
    const out = await renderRun(stage, view, [
      ...hold(before, { params: base }),
      ...grow,
      ...hold(after, { params: scoop(25) }),
    ]);
    // The way back is the way out reversed: same designs, so reuse the frames.
    const back = out.slice(before, before + grow.length).reverse();
    return { frames: [...out, ...back], poster: before + grow.length + after / 2 };
  },
};

/** How far each lid type opens: mm for capping and sliding lids; a hinged lid swings to its stop. */
// From above, a lift reads shorter than a slide, hence the longer lift.
const LID_OPEN: Partial<Record<LidAttachment, number>> = { friction: 36, slide: 42 };

/**
 * Each lid type is framed on its own, so the bin stays large whichever way its
 * lid moves. Per type, 2 s: a crossfade from the previous type's closed bin,
 * seen from the previous framing; an ease into this type's framing; then the
 * open, a hold, and the close.
 */
const lids: Tip = {
  id: 'lids',
  color: '#f87171',
  async capture({ stage }) {
    stage.setTint(this.color);
    const design = (attachment: LidAttachment): ParamOverrides => ({
      width: 2,
      depth: 2,
      height: 4,
      lid: { enabled: true, attachment },
    });
    const FADE = 12;
    const EASE = 12;
    const OPEN = 16;
    const HOLD_OPEN = 6;
    const CLOSE = LID_TIP_SEGMENT_SECONDS * FPS - FADE - EASE - OPEN - HOLD_OPEN;

    const views: View[] = [];
    const opens: number[] = [];
    for (const attachment of LID_TIP_SEGMENTS) {
      await stage.setParams(design(attachment));
      const open = Math.min(LID_OPEN[attachment] ?? Infinity, await stage.lidOffsetMax());
      opens.push(open);
      await stage.setLidOffset(0);
      const closed: Bounds = await stage.bounds();
      await stage.setLidOffset(open);
      const opened = await stage.bounds();
      views.push(await stage.fit(CLIP_CAMERA, { points: [...closed.points, ...opened.points] }));
    }

    const n = LID_TIP_SEGMENTS.length;
    const segments: ThemeFrames[][] = [];
    const closedOwn: ThemeFrames[] = [];
    const closedFromPrev: ThemeFrames[] = [];
    for (const [s, attachment] of LID_TIP_SEGMENTS.entries()) {
      const view = views[s];
      const prevView = views[(s + n - 1) % n];
      const open = opens[s];
      if (!view || !prevView || open === undefined) throw new Error('missing lid framing');
      await stage.setParams(design(attachment));
      await stage.setLidOffset(0);
      closedFromPrev.push(await stage.render(prevView));
      closedOwn.push(await stage.render(view));
      const eased: ThemeFrames[] = [];
      for (let k = 1; k <= EASE; k++) {
        eased.push(await stage.render(lerpView(prevView, view, easeInOut(k / EASE))));
      }
      const motion = await renderRun(
        stage,
        view,
        [...ramp(OPEN, 0, open), ...hold(HOLD_OPEN, open), ...ramp(CLOSE, open, 0)].map((lid) => ({
          params: design(attachment),
          lid,
        }))
      );
      segments.push([...eased, ...motion]);
    }

    const frames: ThemeFrames[] = [];
    for (let s = 0; s < n; s++) {
      const from = closedOwn[(s + n - 1) % n];
      const to = closedFromPrev[s];
      if (!from || !to) throw new Error('missing closed lid frame');
      for (let i = 0; i < FADE; i++) frames.push(await stage.blend(from, to, easeInOut(i / FADE)));
      frames.push(...(segments[s] ?? []));
    }
    // The hinged lid standing open is the most telling single frame.
    const hinged = LID_TIP_SEGMENTS.indexOf('hinge');
    const poster =
      Math.max(0, hinged) * LID_TIP_SEGMENT_SECONDS * FPS + FADE + EASE + OPEN + HOLD_OPEN / 2;
    return { frames, poster };
  },
};

export const TIPS_3D: readonly Tip[] = [scoops, lids];
