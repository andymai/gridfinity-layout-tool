import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipSynth } from './chipSynth';
import { CreditsSoundtrack, crossedAny, musicFor } from './creditsSoundtrack';
import { STEPS_PER_SECOND } from './creditsTune';

describe('musicFor', () => {
  it('plays along at normal speed', () => {
    expect(musicFor(1, true)).toEqual({ mode: 'play', tempo: 1, pitch: 1 });
  });

  it('speeds up and pitches up with a fast-forward, within a cap', () => {
    const fast = musicFor(6, true);
    expect(fast.mode).toBe('play');
    expect(fast.tempo).toBe(1.75);
    expect(fast.pitch).toBeGreaterThan(1);
  });

  it('keeps the tune going, muffled, while paused and warbles while rewinding', () => {
    expect(musicFor(0, true)).toEqual({ mode: 'muffled', tempo: 1, pitch: 1 });
    expect(musicFor(-6, true).mode).toBe('rewind');
  });

  it('never plays slower than normal on a slow scrub', () => {
    expect(musicFor(0.5, true)).toEqual({ mode: 'play', tempo: 1, pitch: 1 });
  });

  it('goes quiet once the credits are over', () => {
    expect(musicFor(1, false).mode).toBe('off');
  });
});

describe('crossedAny', () => {
  const seats = new Float64Array([1, 2.5, 4]);

  it('catches a seat inside the step, counting its end but not its start', () => {
    expect(crossedAny(seats, 2.4, 2.6)).toBe(true);
    expect(crossedAny(seats, 2.5, 3.9)).toBe(false);
    expect(crossedAny(seats, 3.9, 4)).toBe(true);
  });

  it('finds nothing past the last seat or in an empty list', () => {
    expect(crossedAny(seats, 4, 10)).toBe(false);
    expect(crossedAny(new Float64Array(0), 0, 10)).toBe(false);
  });
});

class FakeParam {
  value: number;
  target: number | null = null;
  constructor(value = 1) {
    this.value = value;
  }
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  setTargetAtTime(value: number): this {
    this.target = value;
    return this;
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  connect<T>(next: T): T {
    if (next instanceof FakeNode) this.outputs.push(next);
    return next;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

interface Started {
  node: FakeNode;
  type: string;
  at: number;
}

class FakeSource extends FakeNode {
  type = 'sine';
  buffer: unknown = null;
  readonly frequency = new FakeParam(440);
  private readonly started: Started[];
  constructor(started: Started[]) {
    super();
    this.started = started;
  }
  setPeriodicWave(): void {
    this.type = 'custom';
  }
  start(at = 0): void {
    this.started.push({ node: this, type: this.type, at });
  }
  stop(): void {}
}

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode();
  readonly started: Started[] = [];
  readonly filters: (FakeNode & { type: string; frequency: FakeParam })[] = [];
  createGain(): FakeGain {
    return new FakeGain();
  }
  createBiquadFilter(): FakeNode & { type: string; frequency: FakeParam } {
    const filter = Object.assign(new FakeNode(), {
      type: 'lowpass',
      frequency: new FakeParam(350),
    });
    this.filters.push(filter);
    return filter;
  }
  createDelay(): FakeNode & { delayTime: FakeParam } {
    return Object.assign(new FakeNode(), { delayTime: new FakeParam(0) });
  }
  createPeriodicWave(): object {
    return {};
  }
  createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createOscillator(): FakeSource {
    return new FakeSource(this.started);
  }
  createBufferSource(): FakeSource {
    return new FakeSource(this.started);
  }
}

/** Whether a sound can reach the speakers: some path to the destination crosses no gain settled at 0. */
function audible(node: FakeNode, destination: FakeNode, seen = new Set<FakeNode>()): boolean {
  if (node === destination) return true;
  if (seen.has(node)) return false;
  seen.add(node);
  if (node instanceof FakeGain && (node.gain.target ?? node.gain.value) === 0) return false;
  return node.outputs.some((next) => audible(next, destination, seen));
}

const TICK = 0.025;

function setup() {
  const ctx = new FakeAudioContext();
  const track = new CreditsSoundtrack(ctx as unknown as BaseAudioContext);
  let clock = 0;
  const run = (seconds: number, rate: number, rolling = true): void => {
    for (let t = 0; t < seconds; t += TICK) {
      ctx.currentTime += TICK;
      clock += rate * TICK;
      track.tick(clock, rate, rolling);
    }
  };
  const seek = (to: number): void => {
    clock = to;
  };
  const last = (): Started => ctx.started[ctx.started.length - 1];
  const hears = (sound: Started): boolean => audible(sound.node, ctx.destination);
  return { ctx, track, run, seek, last, hears, clockTime: () => clock };
}

describe('CreditsSoundtrack', () => {
  afterEach(() => vi.restoreAllMocks());
  it('schedules the tune a little ahead of the audio clock while the roll plays', () => {
    const { ctx, run, last, hears } = setup();
    run(1, 1);
    expect(ctx.started.length).toBeGreaterThan(10);
    expect(Math.max(...ctx.started.map((s) => s.at))).toBeLessThanOrEqual(
      ctx.currentTime + 0.12 + 1e-9
    );
    expect(hears(last())).toBe(true);
  });

  it('keeps the tune playing behind a closed filter while paused, then opens it on resume', () => {
    const { ctx, run } = setup();
    const musicFilter = ctx.filters[0];
    run(1, 1);
    run(0.5, 0);
    const paused = ctx.started.length;
    run(1, 0);
    expect(ctx.started.length).toBeGreaterThan(paused);
    expect(musicFilter.frequency.target).toBeLessThan(1000);
    run(0.5, 1);
    expect(musicFilter.frequency.target).toBeGreaterThan(10000);
  });

  it('swaps the tune for a warble while rewinding', () => {
    const { ctx, run } = setup();
    run(1, 1);
    const playing = ctx.started.length;
    run(0.5, -6);
    expect(ctx.started.slice(playing).map((s) => s.type)).toEqual(['sawtooth', 'sine']);
  });

  it('fades the music out at the finale but keeps effects audible', () => {
    const { track, run, last, hears } = setup();
    run(1, 1);
    const note = last();
    run(0.2, 0, false);
    expect(hears(note)).toBe(false);
    track.blip('poke');
    expect(hears(last())).toBe(true);
  });

  it('plays effects when sound is first turned on in the finale', () => {
    const { track, run, last, hears } = setup();
    run(0.2, 0, false);
    track.blip('achievement');
    expect(hears(last())).toBe(true);
  });

  it('plays from the top after Replay instead of rewinding', () => {
    const { ctx, run, seek, last, hears } = setup();
    run(2, 1);
    run(0.2, 0, false);
    seek(0);
    const finale = ctx.started.length;
    run(0.5, 1);
    const replayed = ctx.started.slice(finale);
    expect(replayed.length).toBeGreaterThan(0);
    expect(replayed.some((s) => s.type === 'sawtooth')).toBe(false);
    expect(hears(last())).toBe(true);
  });

  it('keeps normal speed in tune when the clock only moves on animation frames', () => {
    const play = vi.spyOn(ChipSynth.prototype, 'play');
    const ctx = new FakeAudioContext();
    const track = new CreditsSoundtrack(ctx as unknown as BaseAudioContext);
    for (let i = 1; i <= 120; i++) {
      ctx.currentTime = i * TICK;
      track.tick(Math.floor(ctx.currentTime * 60) / 60, 1, true);
    }
    expect(play.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(play.mock.calls.map((call) => call[3]))).toEqual(new Set([1]));
    expect(new Set(play.mock.calls.map((call) => call[2]))).toEqual(
      new Set([1 / STEPS_PER_SECOND])
    );
  });

  it('stretches the tune over a late tick instead of bunching the missed steps', () => {
    const play = vi.spyOn(ChipSynth.prototype, 'play');
    const { ctx, track, run, clockTime } = setup();
    run(1, 1);
    play.mockClear();
    ctx.currentTime += 0.5;
    track.tick(clockTime() + 0.5, 1, true);
    const startsByStep = new Map<number, number>();
    for (const [event, at] of play.mock.calls) startsByStep.set(event.step, at);
    expect(startsByStep.size).toBeGreaterThan(0);
    expect(new Set(startsByStep.values()).size).toBe(startsByStep.size);
  });

  it('plays the downbeat when the first tick is late', () => {
    const play = vi.spyOn(ChipSynth.prototype, 'play');
    const ctx = new FakeAudioContext();
    const track = new CreditsSoundtrack(ctx as unknown as BaseAudioContext);
    ctx.currentTime = 0.5;
    track.tick(0.5, 1, true);
    expect(play.mock.calls[0][0].step).toBe(0);
  });

  it('schedules nothing while waiting for a gesture, then picks up at normal speed', () => {
    const play = vi.spyOn(ChipSynth.prototype, 'play');
    const ctx = new FakeAudioContext();
    ctx.state = 'suspended';
    const track = new CreditsSoundtrack(ctx as unknown as BaseAudioContext);
    for (let i = 1; i <= 40; i++) {
      track.tick(i * TICK, 1, true);
      track.blip('seat');
    }
    expect(ctx.started).toEqual([]);
    ctx.state = 'running';
    for (let i = 41; i <= 60; i++) {
      ctx.currentTime += TICK;
      track.tick(i * TICK, 1, true);
    }
    expect(play.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(play.mock.calls.map((call) => call[3]))).toEqual(new Set([1]));
  });
});
