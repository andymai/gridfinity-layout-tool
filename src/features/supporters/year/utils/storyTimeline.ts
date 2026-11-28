export interface StoryTimeline {
  readonly starts: readonly number[];
  readonly durations: readonly number[];
  readonly total: number;
}

export interface StoryPosition {
  readonly index: number;
  /** 0 to 1 through the current card. */
  readonly progress: number;
  readonly elapsed: number;
}

/** Back within this many seconds of a card's start goes to the card before. */
const RESTART_WINDOW_S = 1;

/** `lead` seconds pass before the first card starts: its entrance. */
export function buildTimeline(durations: readonly number[], lead = 0): StoryTimeline {
  const starts: number[] = [];
  let total = lead;
  for (const duration of durations) {
    starts.push(total);
    total += duration;
  }
  return { starts, durations, total };
}

export function positionAt(timeline: StoryTimeline, time: number): StoryPosition {
  const last = timeline.starts.length - 1;
  let index = 0;
  while (index < last && time >= (timeline.starts[index + 1] ?? Infinity)) index += 1;
  const start = timeline.starts[index] ?? 0;
  const duration = timeline.durations[index] ?? 1;
  const elapsed = Math.max(0, time - start);
  return { index, progress: Math.min(1, elapsed / duration), elapsed };
}

export function startOf(timeline: StoryTimeline, index: number): number {
  const clamped = Math.min(timeline.starts.length - 1, Math.max(0, index));
  return timeline.starts[clamped] ?? 0;
}

/** A skip lands on the next card's start, so a fill in progress is cut, never waited out. */
export function nextTime(timeline: StoryTimeline, time: number): number {
  const { index } = positionAt(timeline, time);
  return index >= timeline.starts.length - 1 ? timeline.total : startOf(timeline, index + 1);
}

/** Like a story app: back first restarts the card, then steps to the one before. */
export function previousTime(timeline: StoryTimeline, time: number): number {
  const { index, elapsed } = positionAt(timeline, time);
  return elapsed > RESTART_WINDOW_S ? startOf(timeline, index) : startOf(timeline, index - 1);
}

export type StoryTransition =
  /** Bins in the target card's colour arrive over the screen. */
  | {
      readonly phase: 'fill';
      readonly target: number;
      /** Seconds into the fill. */
      readonly time: number;
      readonly length: number;
    }
  /** The finished fill fades off the target card, 0 to 1. */
  | { readonly phase: 'dissolve'; readonly target: number; readonly progress: number };

/**
 * What the transition layer shows at `time`. `holds` is each card's own
 * length in seconds, without the fill that follows it.
 */
export function transitionAt(
  timeline: StoryTimeline,
  holds: readonly number[],
  time: number,
  dissolve: number
): StoryTransition | null {
  const lead = timeline.starts[0] ?? 0;
  if (time < lead) return { phase: 'fill', target: 0, time, length: lead };
  const { index } = positionAt(timeline, time);
  const local = time - startOf(timeline, index);
  if (local < dissolve) return { phase: 'dissolve', target: index, progress: local / dissolve };
  const hold = holds[index] ?? Infinity;
  const duration = timeline.durations[index] ?? 0;
  if (index < timeline.starts.length - 1 && local >= hold) {
    return { phase: 'fill', target: index + 1, time: local - hold, length: duration - hold };
  }
  return null;
}
