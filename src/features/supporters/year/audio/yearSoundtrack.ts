import { PadSynth } from './padSynth';
import { STEPS_PER_SECOND, notesBetween } from './yearTune';

const LOOKAHEAD_SECONDS = 0.15;

/**
 * Plays the Your 2026 tune on its own playhead. It takes only a paused flag,
 * never the story clock: a card skip moves the clock, and reading that as
 * playback rate would make the tune lurch on every tap.
 */
export class YearSoundtrack {
  private readonly ctx: BaseAudioContext;
  private readonly synth: PadSynth;
  private position = 0;
  private scheduledTo = 0;
  private lastAudio: number;
  private paused = false;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    // Matches the credits tune's loudness, so the handoff does not jump.
    this.synth = new PadSynth(ctx, 0.2, 0);
    this.synth.fade(1, ctx.currentTime, 1.5);
    this.lastAudio = ctx.currentTime;
  }

  tick(paused: boolean): void {
    const now = this.ctx.currentTime;
    const dt = now - this.lastAudio;
    this.lastAudio = now;
    // A context waiting for a gesture holds its clock still; scheduling now
    // would make every queued note sound at once when it resumes.
    if (this.ctx.state !== 'running') return;
    if (paused !== this.paused) {
      this.synth.muffle(paused, now);
      this.paused = paused;
    }
    // A late tick stretches the tune rather than piling missed steps onto now.
    this.position += Math.min(Math.max(0, dt), LOOKAHEAD_SECONDS) * STEPS_PER_SECOND;
    const until = this.position + LOOKAHEAD_SECONDS * STEPS_PER_SECOND;
    for (const note of notesBetween(this.scheduledTo, until)) {
      const at = now + (note.step - this.position) / STEPS_PER_SECOND;
      this.synth.play(note, Math.max(now, at), 1 / STEPS_PER_SECOND);
    }
    this.scheduledTo = Math.max(this.scheduledTo, until);
  }

  stop(): void {
    this.synth.fade(0, this.ctx.currentTime, 0.8);
  }
}
