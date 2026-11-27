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

export function buildTimeline(durations: readonly number[]): StoryTimeline {
  const starts: number[] = [];
  let total = 0;
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

export function nextTime(timeline: StoryTimeline, time: number): number {
  const { index } = positionAt(timeline, time);
  return index >= timeline.starts.length - 1 ? timeline.total : startOf(timeline, index + 1);
}

/** Like a story app: back first restarts the card, then steps to the one before. */
export function previousTime(timeline: StoryTimeline, time: number): number {
  const { index, elapsed } = positionAt(timeline, time);
  return elapsed > RESTART_WINDOW_S ? startOf(timeline, index) : startOf(timeline, index - 1);
}
