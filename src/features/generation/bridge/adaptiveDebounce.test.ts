import { describe, it, expect } from 'vitest';
import { AdaptiveDebounce } from '../bridge/adaptiveDebounce';

describe('AdaptiveDebounce', () => {
  it('returns default delay (200ms) with no history', () => {
    const ad = new AdaptiveDebounce();
    expect(ad.getDelay()).toBe(200);
  });

  it('adapts delay based on single timing', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(100); // avg=100, delay=100*0.35=35 → clamped to 50
    expect(ad.getDelay()).toBe(50);
  });

  it('produces short delay for fast generations', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(80);
    ad.recordTiming(120);
    ad.recordTiming(100);
    // avg=100, delay=35 → clamped to 50
    expect(ad.getDelay()).toBe(50);
  });

  it('produces medium delay for medium-speed generations', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(400);
    ad.recordTiming(500);
    ad.recordTiming(600);
    // avg=500, delay=500*0.35=175
    expect(ad.getDelay()).toBe(175);
  });

  it('produces proportional delay for slow generations', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(900);
    ad.recordTiming(1000);
    ad.recordTiming(1100);
    // avg=1000, delay=1000*0.35=350 (under 800ms ceiling)
    expect(ad.getDelay()).toBe(350);
  });

  it('uses rolling window of 5 entries', () => {
    const ad = new AdaptiveDebounce();
    // Fill with slow timings
    for (let i = 0; i < 5; i++) {
      ad.recordTiming(1000);
    }
    expect(ad.getDelay()).toBe(350); // avg=1000 → 350ms (no clamp)

    // Add 5 fast timings to push out the slow ones
    for (let i = 0; i < 5; i++) {
      ad.recordTiming(100);
    }
    // avg=100, delay=35 → clamped to 50
    expect(ad.getDelay()).toBe(50);
    expect(ad.size).toBe(5);
  });

  it('resets timing history', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(500);
    ad.recordTiming(600);
    expect(ad.size).toBe(2);

    ad.reset();
    expect(ad.size).toBe(0);
    expect(ad.getDelay()).toBe(200); // back to default
  });

  it('clamps minimum delay to 50ms', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(10); // avg=10, delay=3.5 → clamped to 50
    expect(ad.getDelay()).toBe(50);
  });

  it('clamps maximum delay to 800ms', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(5000); // avg=5000, delay=1750 → clamped to 800
    expect(ad.getDelay()).toBe(800);
  });

  it('handles mixed timings correctly', () => {
    const ad = new AdaptiveDebounce();
    ad.recordTiming(200);
    ad.recordTiming(400);
    ad.recordTiming(600);
    ad.recordTiming(300);
    ad.recordTiming(500);
    // avg=(200+400+600+300+500)/5=400, delay=400*0.35=140
    expect(ad.getDelay()).toBe(140);
  });
});
