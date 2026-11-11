import {
  LID_TIP_SEGMENT_SECONDS,
  LID_TIP_SEGMENTS,
} from '../../src/features/bin-designer/data/featureTips/timing';
import type { FeatureTipId } from '../../src/features/bin-designer/data/featureTips';
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
  id: FeatureTipId;
  /** The feature's colour, from the app's preview palette. */
  color: string;
  capture(ctx: TipContext): Promise<Clip>;
}

interface Step {
  params: ParamOverrides;
  lid?: number;
  /** Label plates shown this far above their seats; see `Stage.setPlateLift`. */
  plates?: number;
}

async function renderRun(stage: Stage, view: View, steps: readonly Step[]): Promise<ThemeFrames[]> {
  const frames: ThemeFrames[] = [];
  let built = '';
  for (const step of steps) {
    const key = JSON.stringify(step.params);
    if (key !== built) {
      await stage.setParams(step.params);
      built = key;
    }
    if (step.lid !== undefined) await stage.setLidOffset(step.lid);
    if (step.plates !== undefined) stage.setPlateLift(step.plates);
    frames.push(await stage.render(view));
  }
  return frames;
}

/**
 * `before` held, the `grow` steps, `after` held, then the grow frames back.
 * Long holds on both ends, so it reads as before and after.
 */
async function sweepLoop(
  stage: Stage,
  view: View,
  before: Step,
  grow: readonly Step[],
  after: Step
): Promise<Clip> {
  const held = 21;
  const payoff = 30;
  const out = await renderRun(stage, view, [
    ...hold(held, before),
    ...grow,
    ...hold(payoff, after),
  ]);
  const back = out.slice(held, held + grow.length).reverse();
  return { frames: [...out, ...back], poster: held + grow.length + payoff / 2 };
}

interface Sweep {
  id: FeatureTipId;
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
  /** The designs paint their own colour zones, so the part is not tinted. */
  zoned?: boolean;
}

/** Plain bin, then the feature appearing and growing from `from` to `to`. */
function sweepTip({
  id,
  color,
  base,
  at,
  from,
  to,
  step,
  camera = CLIP_CAMERA,
  zoned = false,
}: Sweep): Tip {
  return {
    id,
    color,
    async capture({ stage }) {
      stage.setTint(zoned ? null : color);
      await stage.setParams(at(to));
      const view = await stage.fit(camera, await stage.bounds());
      const grow = ramp(30, from, to).map((v) => ({ params: at(Math.round(v / step) * step) }));
      return sweepLoop(stage, view, { params: base }, grow, { params: at(to) });
    },
  };
}

interface Fade {
  id: FeatureTipId;
  color: string;
  /** The design without the feature, then each further state it turns on. */
  states: readonly ParamOverrides[];
  camera?: Camera;
  /** The designs paint their own colour zones, so the part is not tinted. */
  zoned?: boolean;
}

/**
 * For a feature with no value to sweep: the plain bin, each further state
 * crossfading in over the one before, a hold, then a fade back to the start.
 */
function fadeTip({ id, color, states, camera = CLIP_CAMERA, zoned = false }: Fade): Tip {
  return {
    id,
    color,
    async capture({ stage }) {
      const last = states[states.length - 1];
      if (!last || states.length < 2) throw new Error(`${id} needs two states`);
      stage.setTint(zoned ? null : color);
      await stage.setParams(last);
      const view = await stage.fit(camera, await stage.bounds());
      const shots = await renderRun(
        stage,
        view,
        states.map((params) => ({ params }))
      );
      const fade = 12;
      const holds = [21, ...states.slice(2).map(() => 15), 48];
      const frames: ThemeFrames[] = [];
      let poster = 0;
      for (const [i, shot] of shots.entries()) {
        const prev = shots[i - 1];
        if (prev) {
          for (let k = 1; k <= fade; k++) {
            frames.push(await stage.blend(prev, shot, easeInOut(k / fade)));
          }
        }
        const held = holds[i] ?? 0;
        if (i === shots.length - 1) poster = frames.length + Math.floor(held / 2);
        frames.push(...hold(held, shot));
      }
      const end = shots[shots.length - 1];
      const start = shots[0];
      if (!end || !start) throw new Error(`${id} rendered nothing`);
      // Stops one step short: the loop's next frame is the first state itself.
      for (let k = 1; k < fade; k++)
        frames.push(await stage.blend(end, start, easeInOut(k / fade)));
      return { frames, poster };
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

/** Lower walls, so more of the floor shows from the raised camera. */
const SHALLOW_BIN = { width: 2, depth: 2, height: 3 };
const FROM_BELOW: Camera = { ...CLIP_CAMERA, el: -50 };
// The palette's saturated colours all belong to earlier tips. Of the rest,
// slate, stone and charcoal render too dark to hold the bin's outline on the
// dark card, so these tips share cloud and carry accents where they have zones.
const CLOUD = '#e2e8f0';

const LIP_CELLS = ['frontLeft', 'frontRight', 'backRight', 'backLeft'].flatMap((corner) =>
  [0, 1, 2, 3].map((band) => `lip:${corner}:${band}`)
);

/** Multi-color zones: every zone in `body` but the accents. */
function zones(
  body: string,
  accents: { lip?: string; labelTab?: string; text?: string } = {}
): Record<string, unknown> {
  const lip = accents.lip ?? body;
  return {
    enabled: true,
    body,
    base: body,
    scoop: body,
    dividers: body,
    lid: body,
    labelTab: accents.labelTab ?? body,
    text: accents.text ?? body,
    lip: { corners: 1, bands: 1, cells: Object.fromEntries(LIP_CELLS.map((c) => [c, lip])) },
  };
}

const wallPattern = sweepTip({
  id: 'wallPattern',
  color: CLOUD,
  base: TOTE,
  at: (scale) => ({
    ...TOTE,
    wallPattern: {
      enabled: true,
      pattern: 'honeycomb',
      scale,
      sides: { left: false, right: false, front: true, back: false },
    },
  }),
  from: 0.1,
  to: 0.9,
  step: 0.05,
  camera: FACING_FRONT_WALL,
});

const drainageHoles = sweepTip({
  id: 'drainageHoles',
  color: CLOUD,
  base: SHALLOW_BIN,
  at: (scale) => ({ ...SHALLOW_BIN, floorPattern: { enabled: true, pattern: 'round', scale } }),
  from: 0.3,
  to: 1,
  step: 0.1,
});

const magnetHoles = sweepTip({
  id: 'magnetHoles',
  color: CLOUD,
  base: BIN,
  at: (magnetDiameter) => ({ ...BIN, base: { style: 'magnet', magnetDiameter } }),
  from: 4,
  to: 7,
  step: 0.5,
  camera: FROM_BELOW,
});

const lightweightFloor = fadeTip({
  id: 'lightweightFloor',
  color: CLOUD,
  states: [SHALLOW_BIN, { ...SHALLOW_BIN, base: { lightweight: true } }],
});

const WALL_WORD = 'SCREWS';
const WALL_TEXT_COLORS = zones(CLOUD, { text: '#f59e0b' });

/** The word typed onto the front wall, a letter at a time. */
const wallText = sweepTip({
  id: 'wallText',
  color: CLOUD,
  zoned: true,
  base: { ...BIN, featureColors: WALL_TEXT_COLORS },
  at: (letters) => ({
    ...BIN,
    featureColors: WALL_TEXT_COLORS,
    surfaceText: {
      walls: { front: WALL_WORD.slice(0, letters) },
      style: { mode: 'emboss', anchor: 'center', sizeMode: 'fixed', fixedSize: 12 },
    },
  }),
  from: 1,
  to: WALL_WORD.length,
  step: 1,
  camera: FACING_FRONT_WALL,
});

const LABELLED = { ...BIN, compartments: COMPARTMENTS, label: { enabled: true } };

/** One colour, then the lip, then the label tabs take their own. */
const multiColor = fadeTip({
  id: 'multiColor',
  color: CLOUD,
  zoned: true,
  states: [
    { ...LABELLED, featureColors: zones(CLOUD) },
    { ...LABELLED, featureColors: zones(CLOUD, { lip: '#fbbf24' }) },
    { ...LABELLED, featureColors: zones(CLOUD, { lip: '#fbbf24', labelTab: '#f87171' }) },
  ],
});

/** How far above its socket each label plate starts before it drops in, in mm. */
const PLATE_DROP = 18;
const PLATED = {
  ...BIN,
  compartments: { ...COMPARTMENTS, compartmentTexts: ['M3', 'M4'] },
  // 14 mm is MIN_LABEL_SOCKET_TAB_DEPTH_MM: a shallower shelf builds no socket.
  label: { enabled: true, mode: 'socket', depth: 14 },
  // The tint paints the bin; the plates keep the label and text zones.
  featureColors: zones(CLOUD, { labelTab: '#fbbf24', text: '#334155' }),
};

/** The plates hover over their sockets, then drop in. */
const labelPlates: Tip = {
  id: 'labelPlates',
  color: CLOUD,
  async capture({ stage }) {
    stage.setTint(this.color);
    await stage.setParams(PLATED);
    stage.setPlateLift(PLATE_DROP);
    try {
      const view = await stage.fit(CLIP_CAMERA, await stage.bounds());
      const drop = ramp(30, PLATE_DROP, 0).map((plates) => ({ params: PLATED, plates }));
      return await sweepLoop(stage, view, { params: PLATED, plates: PLATE_DROP }, drop, {
        params: PLATED,
        plates: 0,
      });
    } finally {
      stage.setPlateLift(null);
    }
  },
};

/** How far each lid type opens: mm for capping and sliding lids; a hinged lid swings to its stop. */
// From above, a lift reads shorter than a slide, hence the longer lift.
const LID_OPEN: Partial<Record<LidAttachment, number>> = { friction: 36, slide: 42 };

/**
 * Each lid type is framed on its own, so the bin stays large whichever way its
 * lid moves. Per type: a crossfade from the previous type's closed bin,
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
  wallPattern,
  drainageHoles,
  labelPlates,
  magnetHoles,
  multiColor,
  wallText,
  lightweightFloor,
];
