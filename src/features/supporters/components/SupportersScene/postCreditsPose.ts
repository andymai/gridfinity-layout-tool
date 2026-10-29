import { SEAT_DEPTH, easeOutCubic } from './supportersSceneGeometry';

/** Seconds on the finale before the scene starts; the reward for staying. */
export const POST_CREDITS_DELAY = 10;
export const POST_CREDITS_LENGTH = 4.8;
const DROP_FROM = 3.2;

interface Pose {
  x: number;
  y: number;
  yaw: number;
  roll: number;
  scale: number;
}

const phase = (t: number, from: number, to: number): number =>
  Math.min(1, Math.max(0, (t - from) / (to - from)));

/** Drop in, look around, get nudged, pop out: the whole scene as a function of its clock. */
export function postCreditsPose(t: number): Pose {
  const seat = -SEAT_DEPTH;
  const drop = easeOutCubic(phase(t, 0, 0.6));
  const look = phase(t, 0.9, 2.7);
  const nudge = phase(t, 3, 3.35);
  const exit = phase(t, 3.5, POST_CREDITS_LENGTH);
  return {
    x: Math.sin(Math.PI * nudge) * 0.18 + exit * 2.4,
    y: seat + (1 - drop) * DROP_FROM + 4 * exit * (1 - exit) * 2.2 + exit * 1.2,
    yaw: look > 0 && look < 1 ? Math.sin(look * Math.PI * 2) * 0.5 : 0,
    roll: Math.sin(Math.PI * nudge) * 0.12 - exit * Math.PI,
    scale: 1 - exit * exit,
  };
}
