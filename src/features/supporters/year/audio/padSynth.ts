import { midiToHz, type YearNote } from './yearTune';

const OPEN_CUTOFF = 16000;
const MUFFLED_CUTOFF = 600;
const REVERB_SECONDS = 2.6;

/**
 * A soft synth for Your 2026: detuned saw pads with a slow swell, a plucked
 * arpeggio, a sine bass and quiet drums, all sent into a reverb made from
 * noise, so no audio file is needed. Every call takes an explicit start time,
 * so the same synth plays live and into an OfflineAudioContext.
 */
export class PadSynth {
  readonly ctx: BaseAudioContext;
  private readonly music: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly padTone: BiquadFilterNode;
  private readonly reverbSend: GainNode;
  private readonly noise: AudioBuffer;

  constructor(ctx: BaseAudioContext, volume = 0.14, musicLevel = 1) {
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = OPEN_CUTOFF;
    this.filter.connect(master);

    this.music = ctx.createGain();
    this.music.gain.value = musicLevel;
    this.music.connect(this.filter);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse();
    reverb.connect(this.filter);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.45;
    this.reverbSend.connect(reverb);

    this.padTone = ctx.createBiquadFilter();
    this.padTone.type = 'lowpass';
    this.padTone.frequency.value = 1500;
    this.padTone.Q.value = 0.4;
    this.padTone.connect(this.music);
    this.padTone.connect(this.reverbSend);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  play(note: YearNote, at: number, secondsPerStep: number): void {
    const seconds = note.length * secondsPerStep;
    switch (note.voice) {
      case 'pad':
        for (const midi of note.notes) this.pad(midi, at, seconds);
        return;
      case 'pluck':
        this.pluck(note.notes[0] ?? 72, at);
        return;
      case 'bass':
        this.bass(note.notes[0] ?? 41, at, seconds);
        return;
      case 'kick':
        this.kick(at);
        return;
      case 'hat':
        this.hat(at);
        return;
    }
  }

  /** A paused story keeps its music, softly, behind the pause. */
  muffle(on: boolean, at: number): void {
    this.filter.frequency.cancelScheduledValues(at);
    this.filter.frequency.setTargetAtTime(on ? MUFFLED_CUTOFF : OPEN_CUTOFF, at, 0.15);
    this.music.gain.cancelScheduledValues(at);
    this.music.gain.setTargetAtTime(on ? 0.55 : 1, at, 0.2);
  }

  fade(level: number, at: number, seconds: number): void {
    this.music.gain.cancelScheduledValues(at);
    this.music.gain.setValueAtTime(this.music.gain.value, at);
    this.music.gain.linearRampToValueAtTime(level, at + seconds);
  }

  private impulse(): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * REVERB_SECONDS);
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    return buffer;
  }

  private envelope(
    at: number,
    peak: number,
    attack: number,
    hold: number,
    release: number
  ): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, at + Math.max(attack, hold));
    gain.gain.linearRampToValueAtTime(0, at + Math.max(attack, hold) + release);
    return gain;
  }

  private pad(midi: number, at: number, seconds: number): void {
    const gain = this.envelope(at, 0.06, 0.9, seconds, 1.4);
    gain.connect(this.padTone);
    for (const detune of [-7, 7]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToHz(midi);
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + seconds + 1.5);
    }
  }

  private pluck(midi: number, at: number): void {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.09, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    gain.connect(this.music);
    gain.connect(this.reverbSend);
    for (const [type, ratio] of [
      ['triangle', 1],
      ['sine', 2],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = midiToHz(midi) * ratio;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 0.75);
    }
  }

  private bass(midi: number, at: number, seconds: number): void {
    const gain = this.envelope(at, 0.16, 0.02, seconds * 0.8, 0.25);
    gain.connect(this.music);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(midi);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + seconds + 0.3);
  }

  private kick(at: number): void {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    gain.connect(this.music);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + 0.32);
  }

  private hat(at: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const high = this.ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 7000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.025, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    source.connect(high);
    high.connect(gain);
    gain.connect(this.music);
    source.start(at);
    source.stop(at + 0.07);
  }
}
