export const BPM = 88;
export const STEPS_PER_BAR = 16;
export const STEPS_PER_SECOND = (BPM / 60) * 4;

export type YearVoice = 'pad' | 'pluck' | 'bass' | 'kick' | 'hat';

export interface YearNote {
  readonly step: number;
  readonly voice: YearVoice;
  /** MIDI note numbers; a pad plays them all, other voices play the first. */
  readonly notes: readonly number[];
  /** Length in steps. */
  readonly length: number;
}

/** Warm sevenths, one bar each: F, Am, Dm, B♭, F, Am, Gm, C. */
const PROGRESSION: readonly (readonly number[])[] = [
  [53, 57, 60, 64],
  [57, 60, 64, 67],
  [50, 53, 57, 60],
  [46, 50, 53, 57],
  [53, 57, 60, 64],
  [57, 60, 64, 67],
  [55, 58, 62, 65],
  [48, 53, 55, 58],
];
const BASS: readonly number[] = [41, 45, 38, 46, 41, 45, 43, 48];
/** Up the chord and back, in eighths. */
const ARPEGGIO: readonly number[] = [0, 1, 2, 3, 2, 1, 2, 3];

function buildLoop(): YearNote[] {
  const notes: YearNote[] = [];
  PROGRESSION.forEach((chord, bar) => {
    const start = bar * STEPS_PER_BAR;
    const root = BASS.at(bar) ?? 41;
    notes.push({ step: start, voice: 'pad', notes: chord, length: STEPS_PER_BAR });
    notes.push({ step: start, voice: 'bass', notes: [root], length: 6 });
    notes.push({ step: start + 8, voice: 'bass', notes: [root], length: 6 });
    ARPEGGIO.forEach((index, eighth) => {
      notes.push({
        step: start + eighth * 2,
        voice: 'pluck',
        notes: [(chord.at(index) ?? 60) + 12],
        length: 2,
      });
    });
    notes.push({ step: start, voice: 'kick', notes: [], length: 1 });
    notes.push({ step: start + 8, voice: 'kick', notes: [], length: 1 });
    for (const offbeat of [4, 12])
      notes.push({ step: start + offbeat, voice: 'hat', notes: [], length: 1 });
  });
  return notes.sort((a, b) => a.step - b.step);
}

export const LOOP_NOTES: readonly YearNote[] = buildLoop();
export const LOOP_STEPS = PROGRESSION.length * STEPS_PER_BAR;

/** Notes starting in [from, to), on a playhead that keeps counting past the loop. */
export function notesBetween(from: number, to: number): YearNote[] {
  const out: YearNote[] = [];
  if (to <= from) return out;
  for (let loop = Math.floor(from / LOOP_STEPS); loop * LOOP_STEPS < to; loop++) {
    const offset = loop * LOOP_STEPS;
    for (const note of LOOP_NOTES) {
      const step = note.step + offset;
      if (step >= from && step < to) out.push({ ...note, step });
    }
  }
  return out;
}

export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
