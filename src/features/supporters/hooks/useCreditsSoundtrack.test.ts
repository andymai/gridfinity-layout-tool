import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCreditsSoundtrack } from './useCreditsSoundtrack';
import { CreditsClock } from '../utils/creditsClock';

const contexts: { closed: boolean }[] = [];

class FakeAudioContext {
  constructor() {
    contexts.push(this.state);
  }
  state = { closed: false };
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state.closed = true;
  });
  private node = () => ({
    connect: (n: unknown) => n,
    gain: {
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      setTargetAtTime() {},
      exponentialRampToValueAtTime() {},
    },
    frequency: { value: 0, setTargetAtTime() {} },
    delayTime: { value: 0 },
    type: '',
  });
  createGain = this.node;
  createBiquadFilter = this.node;
  createDelay = this.node;
  createPeriodicWave = () => ({});
  createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  contexts.length = 0;
});

describe('useCreditsSoundtrack', () => {
  it('leaves Web Audio alone while sound is off', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    renderHook(() =>
      useCreditsSoundtrack({
        enabled: false,
        clock: new CreditsClock(10),
        schedule: null,
        rolling: true,
      })
    );
    expect(contexts).toHaveLength(0);
  });

  it('opens a context when turned on and closes it when turned off', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const clock = new CreditsClock(10);
    const { rerender } = renderHook(
      ({ enabled }) => useCreditsSoundtrack({ enabled, clock, schedule: null, rolling: true }),
      { initialProps: { enabled: true } }
    );
    expect(contexts).toHaveLength(1);
    rerender({ enabled: false });
    expect(contexts[0].closed).toBe(true);
  });

  it('does nothing where Web Audio does not exist', () => {
    vi.stubGlobal('AudioContext', undefined);
    const { result } = renderHook(() =>
      useCreditsSoundtrack({
        enabled: true,
        clock: new CreditsClock(10),
        schedule: null,
        rolling: true,
      })
    );
    expect(() => result.current.blip('poke')).not.toThrow();
  });
});
