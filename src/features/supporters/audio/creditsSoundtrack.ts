import { ChipSynth, type Blip } from './chipSynth';
import { STEPS_PER_SECOND, chordAt, eventsInWindow } from './creditsTune';

const LOOKAHEAD_SECONDS = 0.12;
const MAX_TEMPO = 1.75;
const VOLUME = 0.16;
/** More clock movement than this (per unit of rate) between ticks is a seek, not frame jitter. */
const SEEK_SLACK_SECONDS = 0.1;

export type MusicMode = 'play' | 'hold' | 'rewind' | 'off';

export interface Music {
  mode: MusicMode;
  tempo: number;
  pitch: number;
}

/**
 * How the tune answers the credits clock: it plays along at the roll's own
 * speed (capped, with the pitch creeping up like a sped-up tape), holds a
 * filtered chord while paused, and warbles while rewinding.
 */
export function musicFor(rate: number, rolling: boolean): Music {
  if (!rolling) return { mode: 'off', tempo: 0, pitch: 1 };
  if (rate < -0.2) return { mode: 'rewind', tempo: 0, pitch: 1 };
  if (rate < 0.2) return { mode: 'hold', tempo: 0, pitch: 1 };
  const tempo = Math.min(MAX_TEMPO, Math.max(0.6, rate));
  return { mode: 'play', tempo, pitch: tempo > 1 ? 1 + (tempo - 1) * 0.2 : 1 };
}

/** Whether any time in the sorted `times` falls in (from, to]. */
export function crossedAny(times: Float64Array, from: number, to: number): boolean {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= from) lo = mid + 1;
    else hi = mid;
  }
  return lo < times.length && times[lo] <= to;
}

/**
 * Drives the synth from the credits clock. Ticked on a short interval; the
 * tune has its own playhead in steps that advances at the roll's rate, and
 * notes are scheduled a little ahead of the audio clock so timer jitter never
 * reaches the ear.
 */
export class CreditsSoundtrack {
  private readonly synth: ChipSynth;
  private readonly ctx: BaseAudioContext;
  private position = 0;
  private scheduledTo = 0;
  private mode: MusicMode = 'off';
  private rate = 1;
  private lastClock: number | null = null;
  private lastAudio = 0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.synth = new ChipSynth(ctx, VOLUME, 0);
    this.lastAudio = ctx.currentTime;
  }

  tick(clockTime: number, clockRate: number, rolling: boolean): void {
    const now = this.ctx.currentTime;
    const dt = now - this.lastAudio;
    this.lastAudio = now;
    if (this.ctx.state !== 'running') {
      // A context waiting for a gesture holds currentTime still, so anything
      // scheduled now would all sound at once when it resumes.
      this.lastClock = rolling ? clockTime : null;
      return;
    }
    if (!rolling) {
      // Replay jumps the clock from the end back to zero; that is not a rewind.
      this.lastClock = null;
      this.rate = 1;
    } else {
      // The clock moves in animation frames, so its motion sampled on a timer
      // jitters around its rate; only a scrub or a jump moves it further.
      let target = clockRate;
      if (this.lastClock !== null && dt > 0) {
        const moved = clockTime - this.lastClock;
        const slack = SEEK_SLACK_SECONDS * Math.max(1, Math.abs(clockRate));
        if (Math.abs(moved - clockRate * dt) > slack) target = moved / dt;
      }
      this.rate += (target - this.rate) * Math.min(1, Math.max(0, dt) * 10);
      this.lastClock = clockTime;
    }

    const music = musicFor(this.rate, rolling);
    if (music.mode !== this.mode) this.transition(this.mode, music.mode, now);
    this.mode = music.mode;
    if (music.mode !== 'play') return;

    const stepsPerSecond = STEPS_PER_SECOND * music.tempo;
    // A late tick stretches the tune rather than piling the steps it missed onto `now`.
    this.position += Math.min(Math.max(0, dt), LOOKAHEAD_SECONDS) * stepsPerSecond;
    const until = this.position + LOOKAHEAD_SECONDS * stepsPerSecond;
    for (const event of eventsInWindow(this.scheduledTo, until)) {
      const at = now + (event.step - this.position) / stepsPerSecond;
      this.synth.play(event, Math.max(now, at), 1 / stepsPerSecond, music.pitch);
    }
    this.scheduledTo = Math.max(this.scheduledTo, until);
  }

  blip(kind: Blip): void {
    if (this.ctx.state !== 'running') return;
    this.synth.blip(kind, this.ctx.currentTime, chordAt(this.position));
  }

  private transition(from: MusicMode, to: MusicMode, now: number): void {
    if (from === 'rewind') this.synth.warble(false, now);
    if (from === 'hold') this.synth.hold(null, now);
    if (from === 'off') this.synth.fade(1, now, 0.6);
    if (to === 'hold') this.synth.hold(chordAt(this.position), now);
    if (to === 'rewind') this.synth.warble(true, now);
    if (to === 'off') this.synth.fade(0, now, 2.5);
    // A pause or rewind leaves notes queued past the playhead; skip them on return.
    if (to === 'play') this.scheduledTo = Math.max(this.scheduledTo, this.position);
  }
}
