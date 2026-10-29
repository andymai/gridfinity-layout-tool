import { midiToHz, type TuneEvent } from './creditsTune';
import { pulseCoefficients } from './pulseWave';

export type Blip = 'seat' | 'poke' | 'achievement' | 'plop';

const OPEN_CUTOFF = 14000;
const HELD_CUTOFF = 650;
/** A dotted eighth at the tune's tempo, so the echo lands on the beat grid. */
const ECHO_SECONDS = (60 / 112) * 0.75;

/**
 * A small chip synth: two pulse voices, a triangle bass and noise drums, a
 * lead echo, and a low-pass that closes for the "held" sound of a paused
 * roll. Effects have their own bus past the music's filter and fade, so a
 * poke in the finale is still heard after the tune has faded out. Everything
 * takes an explicit start time, so the same synth plays live and offline.
 */
export class ChipSynth {
  readonly ctx: BaseAudioContext;
  private readonly music: GainNode;
  private readonly fx: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly leadBus: GainNode;
  private readonly lead: PeriodicWave;
  private readonly arp: PeriodicWave;
  private readonly noise: AudioBuffer;
  private pad: { osc: OscillatorNode; gain: GainNode }[] = [];
  private warbler: { osc: OscillatorNode; lfo: OscillatorNode } | null = null;

  constructor(ctx: BaseAudioContext, volume = 0.16, musicLevel = 1) {
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = musicLevel;
    this.music.connect(master);
    this.fx = ctx.createGain();
    this.fx.connect(master);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = OPEN_CUTOFF;
    this.filter.connect(this.music);

    this.leadBus = ctx.createGain();
    this.leadBus.connect(this.filter);
    const echo = ctx.createDelay(1);
    echo.delayTime.value = ECHO_SECONDS;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.leadBus.connect(echo);
    echo.connect(feedback).connect(echo);
    echo.connect(wet).connect(this.filter);

    const wave = (duty: number) => {
      const { real, imag } = pulseCoefficients(duty);
      return ctx.createPeriodicWave(real, imag);
    };
    this.lead = wave(0.25);
    this.arp = wave(0.125);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  play(event: TuneEvent, at: number, secondsPerStep: number, pitch = 1): void {
    const length = event.length * secondsPerStep;
    const hz = midiToHz(event.midi) * pitch;
    switch (event.voice) {
      case 'lead':
        this.tone(this.lead, hz, at, length * 0.92, 0.3, this.leadBus);
        break;
      case 'arp':
        this.tone(this.arp, hz, at, length * 0.85, 0.08, this.filter);
        break;
      case 'bass':
        this.tone('triangle', hz, at, length * 0.9, 0.42, this.filter);
        break;
      case 'kick':
        this.sweep('sine', 150 * pitch, 42, at, 0.14, 0.75, this.filter);
        break;
      case 'snare':
        this.burst(at, 0.12, 0.28, 'bandpass', 1800);
        this.tone('triangle', 190 * pitch, at, 0.05, 0.18, this.filter);
        break;
      case 'hat':
        this.burst(at, 0.03, 0.1, 'highpass', 7000);
        break;
    }
  }

  blip(kind: Blip, at: number, chord: number[] = [57, 60, 64]): void {
    switch (kind) {
      case 'seat':
        this.tone(
          this.arp,
          midiToHz(chord[Math.floor(Math.random() * chord.length)] + 24),
          at,
          0.05,
          0.07,
          this.fx
        );
        break;
      case 'poke':
        this.sweep('square', 520, 1040, at, 0.08, 0.26, this.fx);
        this.sweep('square', 1040, 700, at + 0.08, 0.08, 0.22, this.fx);
        break;
      case 'achievement':
        [72, 76, 79, 84].forEach((n, i) =>
          this.tone(this.lead, midiToHz(n), at + i * 0.065, 0.12, 0.32, this.fx)
        );
        break;
      case 'plop':
        this.sweep('sine', 420, 110, at, 0.14, 0.55, this.fx);
        break;
    }
  }

  hold(chord: number[] | null, at: number): void {
    this.filter.frequency.setTargetAtTime(chord ? HELD_CUTOFF : OPEN_CUTOFF, at, 0.12);
    for (const { osc, gain } of this.pad) {
      gain.gain.setTargetAtTime(0, at, 0.08);
      osc.stop(at + 0.5);
    }
    this.pad = [];
    if (!chord) return;
    for (const midi of chord) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(midi);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.06, at + 0.25);
      osc.connect(gain).connect(this.filter);
      osc.start(at);
      this.pad.push({ osc, gain });
    }
  }

  /** Rewinding: a wobbling, falling tape whine instead of the tune. */
  warble(on: boolean, at: number): void {
    if (on && !this.warbler) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, at);
      osc.frequency.exponentialRampToValueAtTime(160, at + 2.5);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 7;
      const depth = this.ctx.createGain();
      depth.gain.value = 45;
      lfo.connect(depth).connect(osc.frequency);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.09;
      osc.connect(gain).connect(this.filter);
      osc.start(at);
      lfo.start(at);
      this.warbler = { osc, lfo };
    } else if (!on && this.warbler) {
      this.warbler.osc.stop(at);
      this.warbler.lfo.stop(at);
      this.warbler = null;
    }
  }

  /** The music only: effects keep playing through a fade. */
  fade(level: number, at: number, seconds: number): void {
    this.music.gain.setTargetAtTime(level, at, seconds / 3);
  }

  private tone(
    wave: PeriodicWave | OscillatorType,
    hz: number,
    at: number,
    length: number,
    volume: number,
    out: AudioNode
  ): void {
    const osc = this.ctx.createOscillator();
    // PeriodicWave is an empty interface in the DOM types, so typeof can't narrow it away.
    if (typeof wave === 'string') osc.type = wave as OscillatorType;
    else osc.setPeriodicWave(wave);
    osc.frequency.value = hz;
    const gain = this.ctx.createGain();
    const end = at + Math.max(0.02, length);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.004);
    gain.gain.setTargetAtTime(volume * 0.65, at + 0.004, 0.08);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(end + 0.01);
  }

  private sweep(
    type: OscillatorType,
    from: number,
    to: number,
    at: number,
    length: number,
    volume: number,
    out: AudioNode
  ): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.01);
  }

  private burst(
    at: number,
    length: number,
    volume: number,
    type: BiquadFilterType,
    hz: number
  ): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const band = this.ctx.createBiquadFilter();
    band.type = type;
    band.frequency.value = hz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.connect(band).connect(gain).connect(this.filter);
    src.start(at, Math.random() * 0.5, length + 0.01);
  }
}
