/**
 * An original 16-bar loop for the credits: A minor, 112 bpm, Italo-style
 * changes (i, VI, III, VII) under a pulse lead, a 16th-note pulse arpeggio,
 * an octave-bouncing triangle bass and noise drums. Everything is on a
 * 16th-note grid so the scheduler can play it at any tempo.
 */

export const BPM = 112;
export const STEPS_PER_BAR = 16;
export const STEPS_PER_SECOND = (BPM / 60) * 4;

export type Voice = 'lead' | 'arp' | 'bass' | 'kick' | 'snare' | 'hat';

export interface TuneEvent {
  /** Absolute step from the start of the loop, which repeats forever. */
  step: number;
  voice: Voice;
  /** MIDI note; 0 for drums. */
  midi: number;
  /** Length in steps. */
  length: number;
}

const A2 = 45;
const CHORDS: Record<string, number[]> = {
  Am: [57, 60, 64],
  F: [53, 57, 60],
  C: [48, 52, 55],
  G: [55, 59, 62],
  Dm: [50, 53, 57],
  E: [52, 56, 59],
};
const ROOTS: Record<string, number> = { Am: A2, F: 41, C: 48, G: 43, Dm: 50, E: 40 };
const PROGRESSION = [
  'Am',
  'F',
  'C',
  'G',
  'Am',
  'F',
  'Dm',
  'E',
  'Am',
  'F',
  'C',
  'G',
  'Am',
  'F',
  'G',
  'Am',
];

/** [step in bar, midi, length] per bar. */
const MELODY: [number, number, number][][] = [
  [
    [0, 76, 4],
    [4, 81, 2],
    [6, 79, 2],
    [8, 76, 4],
    [12, 72, 4],
  ],
  [
    [0, 74, 4],
    [4, 72, 2],
    [6, 69, 2],
    [8, 72, 8],
  ],
  [
    [0, 79, 4],
    [4, 76, 2],
    [6, 79, 2],
    [8, 84, 6],
    [14, 83, 2],
  ],
  [
    [0, 79, 8],
    [8, 74, 4],
    [12, 71, 4],
  ],
  [
    [0, 76, 4],
    [4, 81, 2],
    [6, 79, 2],
    [8, 76, 4],
    [12, 81, 4],
  ],
  [
    [0, 84, 4],
    [4, 81, 2],
    [6, 77, 2],
    [8, 81, 8],
  ],
  [
    [0, 77, 4],
    [4, 76, 2],
    [6, 74, 2],
    [8, 77, 4],
    [12, 81, 4],
  ],
  [
    [0, 80, 8],
    [8, 83, 4],
    [12, 76, 4],
  ],
  [
    [0, 76, 4],
    [4, 81, 2],
    [6, 79, 2],
    [8, 76, 4],
    [12, 72, 4],
  ],
  [
    [0, 74, 4],
    [4, 72, 2],
    [6, 69, 2],
    [8, 72, 8],
  ],
  [
    [0, 79, 4],
    [4, 76, 2],
    [6, 79, 2],
    [8, 84, 6],
    [14, 83, 2],
  ],
  [
    [0, 79, 8],
    [8, 83, 4],
    [12, 86, 4],
  ],
  [
    [0, 81, 4],
    [4, 84, 4],
    [8, 83, 2],
    [10, 81, 2],
    [12, 76, 4],
  ],
  [
    [0, 77, 4],
    [4, 81, 4],
    [8, 84, 4],
    [12, 81, 4],
  ],
  [
    [0, 83, 4],
    [4, 79, 2],
    [6, 81, 2],
    [8, 83, 4],
    [12, 86, 4],
  ],
  [
    [0, 84, 6],
    [6, 83, 2],
    [8, 81, 8],
  ],
];

function buildLoop(): TuneEvent[] {
  const events: TuneEvent[] = [];
  PROGRESSION.forEach((chord, bar) => {
    const at = bar * STEPS_PER_BAR;
    for (const [step, midi, length] of MELODY[bar]) {
      events.push({ step: at + step, voice: 'lead', midi, length });
    }
    const tones = [...CHORDS[chord], CHORDS[chord][0] + 12].map((n) => n + 12);
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      events.push({ step: at + s, voice: 'arp', midi: tones[s % tones.length], length: 1 });
    }
    for (let s = 0; s < STEPS_PER_BAR; s += 2) {
      events.push({
        step: at + s,
        voice: 'bass',
        midi: ROOTS[chord] + (s % 4 === 2 ? 12 : 0),
        length: 2,
      });
    }
    for (const s of [0, 8]) events.push({ step: at + s, voice: 'kick', midi: 0, length: 1 });
    for (const s of [4, 12]) events.push({ step: at + s, voice: 'snare', midi: 0, length: 1 });
    for (const s of [2, 6, 10, 14]) events.push({ step: at + s, voice: 'hat', midi: 0, length: 1 });
  });
  return events.sort((a, b) => a.step - b.step);
}

export const LOOP_EVENTS = buildLoop();
export const LOOP_STEPS = PROGRESSION.length * STEPS_PER_BAR;

/** Every event starting in [from, to), in absolute steps across repeats of the loop. */
export function eventsInWindow(from: number, to: number): TuneEvent[] {
  const out: TuneEvent[] = [];
  if (to <= from) return out;
  for (let lap = Math.floor(from / LOOP_STEPS); lap * LOOP_STEPS < to; lap++) {
    const offset = lap * LOOP_STEPS;
    for (const event of LOOP_EVENTS) {
      const step = event.step + offset;
      if (step >= from && step < to) out.push({ ...event, step });
    }
  }
  return out;
}

/** The chord under a step, for blips that should sit in key. */
export function chordAt(step: number): number[] {
  const bar = Math.floor((((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS) / STEPS_PER_BAR);
  return CHORDS[PROGRESSION[bar]];
}

export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
