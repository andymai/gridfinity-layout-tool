type FrameListener = (clock: CreditsClock) => void;

const RATE_RESPONSE = 8;

/**
 * The single playhead behind the roll. The DOM roll, the seated bins, the
 * camera and the soundtrack all read `time` rather than keeping their own, so
 * a scrub moves every one of them together and rewinding un-seats bins for
 * free. Advanced explicitly, so tests drive it without animation frames.
 */
export class CreditsClock {
  time = 0;
  rate = 0;
  duration: number;
  private holdRate: number | null = null;
  private paused = false;
  private ended = false;
  private readonly listeners = new Set<FrameListener>();
  private onEnd: () => void;

  constructor(duration: number, onEnd: () => void = () => {}) {
    this.duration = duration;
    this.onEnd = onEnd;
  }

  setEndHandler(onEnd: () => void): void {
    this.onEnd = onEnd;
  }

  get targetRate(): number {
    return this.holdRate ?? (this.paused ? 0 : 1);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  advance(dt: number): void {
    this.rate += (this.targetRate - this.rate) * (1 - Math.exp(-dt * RATE_RESPONSE));
    this.setTime(this.time + this.rate * dt);
  }

  seek(time: number): void {
    this.setTime(time);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && this.holdRate === null) this.rate = 0;
  }

  /** Fast-forward or rewind while a key or button is held; null releases it. */
  setHoldRate(rate: number | null): void {
    this.holdRate = rate;
  }

  setDuration(duration: number): void {
    this.duration = duration;
    this.setTime(this.time);
  }

  subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setTime(time: number): void {
    this.time = Math.min(this.duration, Math.max(0, time));
    if (this.time < this.duration) {
      this.ended = false;
    } else if (!this.ended && this.duration > 0) {
      this.ended = true;
      this.onEnd();
    }
    for (const listener of this.listeners) listener(this);
  }
}
