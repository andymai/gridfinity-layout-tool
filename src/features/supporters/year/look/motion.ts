/** One beat at 88 BPM. Every arrival in the story lands on this grid, sound or not. */
export const BEAT = 60 / 88;

/** Seconds a text block takes to rise in. */
export const TEXT_ENTER_S = 0.7;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Snaps a time to the nearest subdivision of the beat, such as BEAT / 12. */
export function onGrid(time: number, step: number): number {
  return Math.round(time / step) * step;
}

/** A CSS-style cubic bezier as a function of x. */
export function bezier(p1x: number, p1y: number, p2x: number, p2y: number): (x: number) => number {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sx = (u: number): number => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number): number => ((ay * u + by) * u + cy) * u;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let u = x;
    for (let i = 0; i < 32; i++) {
      if (sx(u) < x) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

export const easeOut = bezier(0.23, 1, 0.32, 1);
export const easeInOut = bezier(0.77, 0, 0.175, 1);

/**
 * A damped spring's displacement, 1 at rest before `t` 0 and settling to 0.
 * `duration` is the perceptual length and `bounce` runs 0 to 1.
 */
export function springX(t: number, duration: number, bounce: number): number {
  if (t <= 0) return 1;
  const zeta = 1 - bounce;
  const w0 = (2 * Math.PI) / duration;
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
}

/** When the spring first crosses zero, and the time between crossings. */
export function springContact(
  duration: number,
  bounce: number
): { readonly first: number; readonly period: number } {
  const zeta = 1 - bounce;
  const w0 = (2 * Math.PI) / duration;
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return { first: (Math.PI - Math.atan(wd / (zeta * w0))) / wd, period: Math.PI / wd };
}

/** A short squash at a contact, then a smaller stretch back. */
export function squash(t: number, amount: number): number {
  if (t < 0 || t > 0.26) return 0;
  if (t < 0.11) return amount * Math.sin((Math.PI * t) / 0.11);
  if (t < 0.22) return -amount * 0.3 * Math.sin((Math.PI * (t - 0.11)) / 0.11);
  return 0;
}

/** A stable pseudo-random value in [0, 1) for a pair of integers. */
export function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface Pose {
  readonly opacity: number;
  readonly x: number;
  readonly y: number;
  /** Degrees. */
  readonly rotate: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export const REST: Pose = { opacity: 1, x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };

/** Reduced motion keeps the beat but only fades: a short opacity step at `at`. */
export function fadeAt(t: number, at: number, length = 0.3): number {
  return easeOut(clamp01((t - at) / length));
}

/** A text block rising in from `rise` px below; reduced motion keeps only the fade. */
export function enterPose(
  t: number,
  start: number,
  rise: number,
  reduced: boolean,
  length = TEXT_ENTER_S
): Pose {
  if (reduced) return { ...REST, opacity: fadeAt(t, start, 0.45) };
  return {
    ...REST,
    opacity: easeOut(clamp01((t - start) / (length * 0.5))),
    y: rise * (1 - easeOut(clamp01((t - start) / length))),
  };
}

export interface DropSpec {
  /** Seconds at which the object first touches the floor. */
  readonly contact: number;
  /** Fall height in px. */
  readonly height: number;
  readonly bounce?: number;
  readonly duration?: number;
  readonly squash?: number;
  /** Degrees of tilt that springs out as it lands. */
  readonly tilt?: number;
}

/** A drop from above with a floor bounce and a squash at each contact. */
export function dropPose(t: number, spec: DropSpec): Pose {
  const bounce = spec.bounce ?? 0.25;
  const duration = spec.duration ?? 0.55 * Math.sqrt(spec.height / 170);
  const { first, period } = springContact(duration, bounce);
  const elapsed = t - (spec.contact - first);
  const amount = spec.squash ?? 0.08;
  const s = squash(t - spec.contact, amount) + squash(t - spec.contact - period, amount * 0.3);
  return {
    opacity: elapsed > 0 ? 1 : 0,
    x: 0,
    y: -spec.height * Math.abs(springX(elapsed, duration, bounce)),
    rotate: spec.tilt ? spec.tilt * springX(elapsed, duration * 1.3, 0.3) : 0,
    scaleX: 1 + s * 0.5,
    scaleY: 1 - s,
  };
}

/** A pose as a CSS transform, for DOM elements. */
export function poseTransform(pose: Pose): string {
  return `translate(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px) rotate(${pose.rotate.toFixed(2)}deg) scale(${pose.scaleX.toFixed(4)}, ${pose.scaleY.toFixed(4)})`;
}
