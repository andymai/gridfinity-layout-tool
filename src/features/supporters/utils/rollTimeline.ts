/** A credit the roll slows down for, so it can be read. */
export interface ReadingMark {
  /** Roll offset (px) at which the credit's centre crosses the reading line. */
  at: number;
  height: number;
  /** Seconds the credit should spend in its reading window. */
  dwell: number;
}

export interface RollTimelineInput {
  startOffset: number;
  endOffset: number;
  /** Speed (px/s) everywhere outside a reading window. */
  baseSpeed: number;
  marks: ReadingMark[];
  /** Seconds the title card holds before the roll starts moving. */
  introSeconds: number;
}

export interface RollTimeline {
  introSeconds: number;
  duration: number;
  startOffset: number;
  endOffset: number;
  timeAt: (offset: number) => number;
  offsetAt: (time: number) => number;
}

const SAMPLE_PX = 2;
const WINDOW_PAD_PX = 48;
const RAMP_PX = 72;

/** Reading time for a quote, from a skim pace of about 20 characters a second. */
export function messageDwell(characters: number): number {
  return Math.min(6, Math.max(2, 0.9 + characters / 20));
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * Map roll time to offset and back. Speed is defined per offset (base speed,
 * dipping smoothly inside each mark's reading window), then integrated into a
 * cumulative time table, so the roll eases into and out of every quote rather
 * than stopping dead. The intro is a flat run at `startOffset`.
 */
export function buildRollTimeline(input: RollTimelineInput): RollTimeline {
  const { startOffset, baseSpeed, introSeconds } = input;
  const endOffset = Math.max(startOffset, input.endOffset);
  const marks = [...input.marks].sort((a, b) => a.at - b.at);

  const speedAt = (offset: number): number => {
    let speed = baseSpeed;
    for (const mark of marks) {
      const half = mark.height / 2 + WINDOW_PAD_PX;
      const distance = Math.abs(offset - mark.at);
      if (distance >= half + RAMP_PX) continue;
      const slow = Math.min(baseSpeed, (2 * half) / mark.dwell);
      const weight = distance <= half ? 1 : smoothstep(1 - (distance - half) / RAMP_PX);
      speed = Math.min(speed, baseSpeed + (slow - baseSpeed) * weight);
    }
    return speed;
  };

  const samples = Math.max(2, Math.ceil((endOffset - startOffset) / SAMPLE_PX) + 1);
  const step = (endOffset - startOffset) / (samples - 1);
  const times = new Float64Array(samples);
  times[0] = introSeconds;
  let previousInverse = 1 / speedAt(startOffset);
  for (let i = 1; i < samples; i++) {
    const inverse = 1 / speedAt(startOffset + i * step);
    times[i] = times[i - 1] + (step * (previousInverse + inverse)) / 2;
    previousInverse = inverse;
  }
  const duration = times[samples - 1];

  const timeAt = (offset: number): number => {
    if (step === 0 || offset <= startOffset) return introSeconds;
    if (offset >= endOffset) return duration;
    const f = (offset - startOffset) / step;
    const i = Math.floor(f);
    return times[i] + (times[i + 1] - times[i]) * (f - i);
  };

  const offsetAt = (time: number): number => {
    if (time <= introSeconds) return startOffset;
    if (time >= duration) return endOffset;
    let lo = 0;
    let hi = samples - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid;
      else hi = mid;
    }
    const span = times[hi] - times[lo];
    return startOffset + step * (lo + (span > 0 ? (time - times[lo]) / span : 0));
  };

  return { introSeconds, duration, startOffset, endOffset, timeAt, offsetAt };
}

/**
 * The playhead after moving the roll by `deltaPx`, as a wheel or drag would.
 * Distance maps through the roll's offset, so a scrub moves the text exactly
 * as far as the hand did; before the first credit it rewinds into the title
 * card at the base speed.
 */
export function scrubTime(
  timeline: RollTimeline,
  time: number,
  deltaPx: number,
  baseSpeed: number
): number {
  if (time < timeline.introSeconds) return time + deltaPx / baseSpeed;
  const offset = timeline.offsetAt(time) + deltaPx;
  if (offset < timeline.startOffset) {
    return timeline.introSeconds - (timeline.startOffset - offset) / baseSpeed;
  }
  return timeline.timeAt(offset);
}
