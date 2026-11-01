import {
  LID_TIP_SEGMENT_SECONDS,
  LID_TIP_SEGMENTS,
} from '../../src/features/bin-designer/data/featureTips/timing';
import type { LidAttachment } from '../../src/features/bin-designer/types/lid';
import { FPS } from './encode';
import { CLIP_CAMERA, lerpView } from './stage';
import type { Bounds, Camera, ParamOverrides, Stage, ThemeFrames, View } from './stage';

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

interface Sweep {
  id: string;
  color: string;
  /** The design without the feature. */
  base: ParamOverrides;
  /** The design with the feature at `value`. */
  at: (value: number) => ParamOverrides;
  from: number;
  to: number;
  /** Rounds each swept value, so the frames ask for buildable sizes. */
  step: number;
  camera?: Camera;
}

/**
 * Plain bin, the feature appearing and growing from `from` to `to`, a hold,
 * then the same frames back. Long holds on both ends, so it reads as before
 * and after.
 */
function sweepTip({ id, color, base, at, from, to, step, camera = CLIP_CAMERA }: Sweep): Tip {
  return {
    id,
    color,
    async capture({ stage }) {
      stage.setTint(color);
      await stage.setParams(at(to));
      const view = await stage.fit(camera, await stage.bounds());
      const grow = ramp(30, from, to).map((v) => ({ params: at(Math.round(v / step) * step) }));
      const before = 21;
      const after = 30;
      const out = await renderRun(stage, view, [
        ...hold(before, { params: base }),
        ...grow,
        ...hold(after, { params: at(to) }),
      ]);
      const back = out.slice(before, before + grow.length).reverse();
      return { frames: [...out, ...back], poster: before + grow.length + after / 2 };
    },
  };
}

const COMPARTMENTS = { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] };
const BIN = { width: 2, depth: 2, height: 4 };
// Features on the outside of a bin hide from the raised camera that suits
// the inside, so each of these is shot from where it shows.
const FACING_FRONT_WALL: Camera = { ...CLIP_CAMERA, az: -65, el: 25 };
const TOTE = { width: 3, depth: 2, height: 6 };

const scoops = sweepTip({
  id: 'scoops',
  color: '#2dd4bf',
  base: { ...BIN, compartments: COMPARTMENTS },
  at: (radius) => ({
    ...BIN,
    compartments: COMPARTMENTS,
    scoop: { enabled: true, radius, style: 'curved', side: 'front' },
  }),
  from: 5,
  to: 25,
  step: 0.5,
  // The scoop rises up the front wall's inner face, which faces away from a
  // front camera, so this one clip looks from the back at the same height.
  camera: { ...CLIP_CAMERA, az: CLIP_CAMERA.az + 180 },
});

const handles = sweepTip({
  id: 'handles',
  color: '#fb923c',
  base: TOTE,
  at: (width) => ({ ...TOTE, handles: { enabled: true, width } }),
  from: 20,
  to: 55,
  step: 1,
  camera: FACING_FRONT_WALL,
});

const wallCutouts = sweepTip({
  id: 'wallCutouts',
  color: '#4ade80',
  base: TOTE,
  at: (depth) => ({
    ...TOTE,
    walls: {
      enabled: true,
      front: { enabled: true, width: 60, depth },
      left: { enabled: false },
      right: { enabled: false },
    },
  }),
  from: 15,
  to: 55,
  step: 1,
  camera: { ...CLIP_CAMERA, az: -70, el: 22 },
});

const labelTabs = sweepTip({
  id: 'labelTabs',
  color: '#fbbf24',
  base: { ...BIN, compartments: COMPARTMENTS },
  at: (depth) => ({ ...BIN, compartments: COMPARTMENTS, label: { enabled: true, depth } }),
  from: 6,
  to: 16,
  step: 0.5,
});

const overhang = sweepTip({
  id: 'overhang',
  color: '#818cf8',
  base: BIN,
  at: (mm) => ({ ...BIN, overhang: { enabled: true, front: mm, right: mm, feet: false } }),
  from: 3,
  to: 21,
  step: 1,
  // From below, the feet stay on the grid footprint while the body grows past
  // them; from above, an overhang only reads as a bigger bin.
  camera: { ...CLIP_CAMERA, el: -35 },
});

const slant = sweepTip({
  id: 'slant',
  color: '#a3e635',
  base: BIN,
  at: (angleDeg) => ({ ...BIN, slant: { angleDeg, side: 'front', endSupport: true } }),
  from: 4,
  to: 30,
  step: 1,
  camera: { ...CLIP_CAMERA, az: 0, el: 10 },
});

const pullTab = sweepTip({
  id: 'pullTab',
  color: '#38bdf8',
  base: BIN,
  at: (height) => ({ ...BIN, pullTab: { enabled: true, height, backRecess: true } }),
  from: 4,
  to: 16,
  step: 0.5,
  camera: FACING_FRONT_WALL,
});

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

export const TIPS_3D: readonly Tip[] = [
  scoops,
  lids,
  handles,
  wallCutouts,
  labelTabs,
  overhang,
  slant,
  pullTab,
];
