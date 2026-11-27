import { describe, expect, it, vi } from 'vitest';
import { PadSynth } from './padSynth';
import { YearSoundtrack } from './yearSoundtrack';

class FakeParam {
  value = 1;
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  setTargetAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect(): void {}
}

class FakeSource extends FakeNode {
  private readonly starts: number[];
  constructor(starts: number[]) {
    super();
    this.starts = starts;
  }
  start(at: number): void {
    this.starts.push(at);
  }
  stop(): void {}
}

function fakeContext(state: AudioContextState = 'running') {
  const starts: number[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state,
    destination: new FakeNode(),
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createConvolver: () => new FakeNode(),
    createOscillator: () => new FakeSource(starts),
    createBufferSource: () => new FakeSource(starts),
    createBuffer: (channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
      numberOfChannels: channels,
    }),
  };
  return { ctx: ctx as unknown as BaseAudioContext & { currentTime: number }, starts };
}

describe('YearSoundtrack', () => {
  it('schedules notes a little ahead while playing', () => {
    const { ctx, starts } = fakeContext();
    const track = new YearSoundtrack(ctx);
    for (let i = 1; i <= 20; i++) {
      ctx.currentTime = i * 0.05;
      track.tick(false);
    }
    expect(starts.length).toBeGreaterThan(0);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...starts)).toBeLessThanOrEqual(ctx.currentTime + 0.2);
  });

  it('schedules nothing while the context waits for a gesture', () => {
    const { ctx, starts } = fakeContext('suspended');
    const track = new YearSoundtrack(ctx);
    ctx.currentTime = 1;
    track.tick(false);
    expect(starts).toEqual([]);
  });

  it('muffles once on pause and opens again on play', () => {
    const muffle = vi.spyOn(PadSynth.prototype, 'muffle');
    const { ctx } = fakeContext();
    const track = new YearSoundtrack(ctx);
    ctx.currentTime = 0.1;
    track.tick(true);
    ctx.currentTime = 0.2;
    track.tick(true);
    ctx.currentTime = 0.3;
    track.tick(false);
    expect(muffle.mock.calls.map(([on]) => on)).toEqual([true, false]);
    muffle.mockRestore();
  });

  it('never piles a long stall onto the next tick', () => {
    const { ctx, starts } = fakeContext();
    const track = new YearSoundtrack(ctx);
    ctx.currentTime = 30;
    track.tick(false);
    // Only the opening beat (8 pad oscillators, bass, 2 pluck partials, kick),
    // not thirty seconds of backlog, and all of it from now on.
    expect(starts).toHaveLength(12);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(30);
  });
});

class RecordingNode extends FakeNode {
  readonly targets: unknown[] = [];
  ramps = 0;
  constructor() {
    super();
    this.gain.linearRampToValueAtTime = () => {
      this.ramps++;
      return this.gain;
    };
  }
  override connect(target?: unknown): void {
    this.targets.push(target);
  }
}

describe('PadSynth', () => {
  it('sends the reverb through the music gain, so a fade reaches the whole tune', () => {
    const { ctx } = fakeContext();
    const gains: RecordingNode[] = [];
    const reverbs: RecordingNode[] = [];
    const recording = Object.assign(Object.create(ctx) as typeof ctx, {
      createGain: () => {
        const node = new RecordingNode();
        gains.push(node);
        return node;
      },
      createConvolver: () => {
        const node = new RecordingNode();
        reverbs.push(node);
        return node;
      },
    });
    const synth = new PadSynth(recording);
    synth.fade(0, 0, 1);
    const faded = gains.find((node) => node.ramps > 0);
    expect(faded).toBeDefined();
    expect(reverbs[0]?.targets).toContain(faded);
  });
});
