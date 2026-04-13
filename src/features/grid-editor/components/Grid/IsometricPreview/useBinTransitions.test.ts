import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  stepSpring,
  useBinTransitions,
  SPRING_STIFFNESS,
  SPRING_DAMPING,
  DROP_HEIGHT,
  EXIT_DURATION_S,
  EXIT_MIN_SCALE,
  STAGGER_DELAY_S,
} from './useBinTransitions';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { Bin } from '@/core/types';

function createBinRenderData(id: string, overrides: Partial<BinRenderData> = {}): BinRenderData {
  return {
    bin: {
      id,
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      layerId: 'layer-1',
      category: 'cat-1',
      clearanceHeight: 0,
    } as Bin,
    x: 0,
    y: 0,
    z: 0,
    height: 0.5,
    clearanceHeight: 0,
    color: '#ff0000',
    opacity: 1,
    ...overrides,
  };
}

// ── stepSpring ────────────────────────────────────────────────────────

describe('stepSpring', () => {
  it('moves position toward zero from positive offset', () => {
    const { pos } = stepSpring(DROP_HEIGHT, 0, 1 / 60);
    expect(pos).toBeLessThan(DROP_HEIGHT);
    expect(pos).toBeGreaterThan(0);
  });

  it('produces negative velocity (moving downward) from rest at positive pos', () => {
    const { vel } = stepSpring(DROP_HEIGHT, 0, 1 / 60);
    expect(vel).toBeLessThan(0);
  });

  it('overshoots past zero (underdamped) when given enough steps', () => {
    let pos = DROP_HEIGHT;
    let vel = 0;
    const dt = 1 / 60;
    let wentNegative = false;

    for (let i = 0; i < 300; i++) {
      const step = stepSpring(pos, vel, dt);
      pos = step.pos;
      vel = step.vel;
      if (pos < 0) {
        wentNegative = true;
        break;
      }
    }

    expect(wentNegative).toBe(true);
  });

  it('settles close to zero after many frames', () => {
    let pos = DROP_HEIGHT;
    let vel = 0;
    const dt = 1 / 60;

    for (let i = 0; i < 600; i++) {
      const step = stepSpring(pos, vel, dt);
      pos = step.pos;
      vel = step.vel;
    }

    expect(Math.abs(pos)).toBeLessThan(0.001);
    expect(Math.abs(vel)).toBeLessThan(0.01);
  });

  it('is stable at large dt (e.g. lag spikes)', () => {
    const { pos, vel } = stepSpring(DROP_HEIGHT, 0, 0.1);
    expect(Number.isFinite(pos)).toBe(true);
    expect(Number.isFinite(vel)).toBe(true);
  });
});

// ── useBinTransitions ─────────────────────────────────────────────────

describe('useBinTransitions', () => {
  it('returns all bins as stable on initial mount (no animations)', () => {
    const bins = [createBinRenderData('a'), createBinRenderData('b')];

    const { result } = renderHook(() => useBinTransitions(bins, false));

    expect(result.current.stableBins).toHaveLength(2);
    expect(result.current.enteringBins).toHaveLength(0);
    expect(result.current.exitingGhosts).toHaveLength(0);
  });

  it('detects new bins as entering on subsequent render', () => {
    const bins1 = [createBinRenderData('a')];
    const bins2 = [createBinRenderData('a'), createBinRenderData('b')];

    const { result, rerender } = renderHook(({ bins }) => useBinTransitions(bins, false), {
      initialProps: { bins: bins1 },
    });

    rerender({ bins: bins2 });

    expect(result.current.enteringBins).toHaveLength(1);
    expect(result.current.enteringBins[0].binData.bin.id).toBe('b');
    expect(result.current.enteringBins[0].transition.phase).toBe('entering');
    // 'b' should be excluded from stableBins
    expect(result.current.stableBins.map((b) => b.bin.id)).toEqual(['a']);
  });

  it('detects removed bins as exiting ghosts', () => {
    const bins1 = [createBinRenderData('a'), createBinRenderData('b')];
    const bins2 = [createBinRenderData('a')];

    const { result, rerender } = renderHook(({ bins }) => useBinTransitions(bins, false), {
      initialProps: { bins: bins1 },
    });

    rerender({ bins: bins2 });

    expect(result.current.exitingGhosts).toHaveLength(1);
    expect(result.current.exitingGhosts[0].binData.bin.id).toBe('b');
    expect(result.current.exitingGhosts[0].transition.phase).toBe('exiting');
  });

  it('skips all animations when reducedMotion is true', () => {
    const bins1 = [createBinRenderData('a')];
    const bins2 = [createBinRenderData('a'), createBinRenderData('b')];

    const { result, rerender } = renderHook(({ bins }) => useBinTransitions(bins, true), {
      initialProps: { bins: bins1 },
    });

    rerender({ bins: bins2 });

    expect(result.current.stableBins).toHaveLength(2);
    expect(result.current.enteringBins).toHaveLength(0);
    expect(result.current.exitingGhosts).toHaveLength(0);
  });

  it('applies stagger delay for bulk additions', () => {
    const bins1 = [createBinRenderData('a')];
    const bins2 = [
      createBinRenderData('a'),
      createBinRenderData('b'),
      createBinRenderData('c'),
      createBinRenderData('d'),
    ];

    const { result, rerender } = renderHook(({ bins }) => useBinTransitions(bins, false), {
      initialProps: { bins: bins1 },
    });

    rerender({ bins: bins2 });

    expect(result.current.enteringBins).toHaveLength(3);
    const delays = result.current.enteringBins.map((b) => b.transition.staggerDelay);
    expect(delays[0]).toBeCloseTo(0);
    expect(delays[1]).toBeCloseTo(STAGGER_DELAY_S);
    expect(delays[2]).toBeCloseTo(STAGGER_DELAY_S * 2);
  });

  it('skips animations on layout switch (low overlap)', () => {
    // Simulate switching from one layout to a completely different one
    const bins1 = [createBinRenderData('a'), createBinRenderData('b'), createBinRenderData('c')];
    const bins2 = [createBinRenderData('x'), createBinRenderData('y'), createBinRenderData('z')];

    const { result, rerender } = renderHook(({ bins }) => useBinTransitions(bins, false), {
      initialProps: { bins: bins1 },
    });

    rerender({ bins: bins2 });

    // Should detect layout switch (0% overlap) and skip animations
    expect(result.current.stableBins).toHaveLength(3);
    expect(result.current.enteringBins).toHaveLength(0);
    expect(result.current.exitingGhosts).toHaveLength(0);
  });

  it('tick advances entering spring animation', () => {
    const bins1 = [createBinRenderData('a')];
    const bins2 = [createBinRenderData('a'), createBinRenderData('b')];

    const { result, rerender } = renderHook(({ bins }) => useBinTransitions(bins, false), {
      initialProps: { bins: bins1 },
    });

    rerender({ bins: bins2 });

    const initialSpringPos = result.current.enteringBins[0].transition;
    expect(initialSpringPos.phase).toBe('entering');
    if (initialSpringPos.phase === 'entering') {
      expect(initialSpringPos.springPos).toBe(DROP_HEIGHT);
    }

    // Tick forward
    result.current.tick(1 / 60);

    // Spring should have moved
    const afterTick = result.current.enteringBins[0]?.transition;
    if (afterTick && afterTick.phase === 'entering') {
      expect(afterTick.springPos).toBeLessThan(DROP_HEIGHT);
    }
  });
});

// ── Constants validation ──────────────────────────────────────────────

describe('animation constants', () => {
  it('spring is underdamped (damping ratio < 1)', () => {
    const dampingRatio = SPRING_DAMPING / (2 * Math.sqrt(SPRING_STIFFNESS));
    expect(dampingRatio).toBeLessThan(1);
    expect(dampingRatio).toBeGreaterThan(0.3); // Not too bouncy
  });

  it('drop height is reasonable', () => {
    expect(DROP_HEIGHT).toBeGreaterThan(0);
    expect(DROP_HEIGHT).toBeLessThanOrEqual(5);
  });

  it('exit duration is reasonable', () => {
    expect(EXIT_DURATION_S).toBeGreaterThan(0.05);
    expect(EXIT_DURATION_S).toBeLessThanOrEqual(1);
  });

  it('exit min scale is between 0 and 1', () => {
    expect(EXIT_MIN_SCALE).toBeGreaterThan(0);
    expect(EXIT_MIN_SCALE).toBeLessThan(1);
  });

  it('stagger delay is reasonable', () => {
    expect(STAGGER_DELAY_S).toBeGreaterThan(0);
    expect(STAGGER_DELAY_S).toBeLessThanOrEqual(0.1);
  });
});
