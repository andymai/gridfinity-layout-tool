import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import {
  applyDeadzone,
  computeFrameMotion,
  isDeflectionIdle,
  normalizeAxis,
  toDeflection,
} from './mapping';
import type { RawDeflection, SpaceMouseSettings } from './types';

const zeroRaw: RawDeflection = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { pitch: 0, roll: 0, yaw: 0 },
};

describe('normalizeAxis', () => {
  it('scales by full-scale and clamps to [-1, 1]', () => {
    expect(normalizeAxis(175, 350)).toBeCloseTo(0.5);
    expect(normalizeAxis(700, 350)).toBe(1);
    expect(normalizeAxis(-700, 350)).toBe(-1);
    expect(normalizeAxis(0)).toBe(0);
  });
});

describe('applyDeadzone', () => {
  it('zeroes values inside the deadzone', () => {
    expect(applyDeadzone(0.03, 0.06)).toBe(0);
    expect(applyDeadzone(-0.06, 0.06)).toBe(0);
  });

  it('ramps from zero at the deadzone edge and preserves sign', () => {
    expect(applyDeadzone(0.06 + 1e-9, 0.06)).toBeCloseTo(0, 5);
    expect(applyDeadzone(1, 0.06)).toBeCloseTo(1);
    expect(applyDeadzone(-1, 0.06)).toBeCloseTo(-1);
    expect(applyDeadzone(0.53, 0.06)).toBeGreaterThan(0);
  });
});

/** Device translation axes: x+ right, y+ pulled back toward the user, z+ down. */
const deflect = (translation: Partial<RawDeflection['translation']>): RawDeflection => ({
  translation: { x: 0, y: 0, z: 0, ...translation },
  rotation: { pitch: 0, roll: 0, yaw: 0 },
});

describe('toDeflection', () => {
  it('is idle for a centered puck', () => {
    expect(isDeflectionIdle(toDeflection(zeroRaw, DEFAULT_SETTINGS))).toBe(true);
  });

  // Signs are stated as what the user sees, because pan moves the camera and so
  // reads backwards from the deflection. Matches Fusion/PrusaSlicer (#4041).
  it('slides the model right when the puck goes right', () => {
    const d = toDeflection(deflect({ x: 350 }), DEFAULT_SETTINGS);
    expect(d.panX).toBeCloseTo(-1); // camera left, so the model tracks right
    expect(d.panY).toBe(0);
    expect(d.zoom).toBe(0);
  });

  it('slides the model up when the puck is lifted, never zooms', () => {
    const d = toDeflection(deflect({ z: -350 }), DEFAULT_SETTINGS);
    expect(d.panY).toBeCloseTo(-1); // camera down, so the model tracks up
    expect(d.zoom).toBe(0);
  });

  it('zooms in when the puck is pulled back, never pans', () => {
    const d = toDeflection(deflect({ y: 350 }), DEFAULT_SETTINGS);
    expect(d.zoom).toBeCloseTo(1); // positive dollies toward the target
    expect(d.panY).toBe(0);
  });

  it('maps yaw and pitch to orbit unchanged', () => {
    const d = toDeflection(
      { translation: { x: 0, y: 0, z: 0 }, rotation: { pitch: 350, roll: 350, yaw: 350 } },
      DEFAULT_SETTINGS
    );
    expect(d.orbitH).toBeCloseTo(1);
    expect(d.orbitV).toBeCloseTo(1);
  });

  it('honors per-axis inversion', () => {
    const settings: SpaceMouseSettings = {
      ...DEFAULT_SETTINGS,
      invert: { ...DEFAULT_SETTINGS.invert, panX: true, orbitH: true },
    };
    const raw: RawDeflection = {
      translation: { x: 350, y: 0, z: 0 },
      rotation: { pitch: 0, roll: 0, yaw: 350 },
    };
    const d = toDeflection(raw, settings);
    expect(d.panX).toBeCloseTo(1); // invert flips the corrected base sign back
    expect(d.orbitH).toBeCloseTo(-1);
  });
});

describe('computeFrameMotion', () => {
  const full = toDeflection(
    {
      translation: { x: 350, y: 350, z: -350 },
      rotation: { pitch: 350, roll: 0, yaw: 350 },
    },
    DEFAULT_SETTINGS
  );

  it('scales pan with distance and time', () => {
    const near = computeFrameMotion(full, DEFAULT_SETTINGS, 1 / 60, 10);
    const far = computeFrameMotion(full, DEFAULT_SETTINGS, 1 / 60, 100);
    expect(far.panX).toBeCloseTo(near.panX * 10);
    expect(far.panX).toBeLessThan(0); // camera left, so the model tracks the puck right
  });

  it('scales all motion by sensitivity', () => {
    const base = computeFrameMotion(full, DEFAULT_SETTINGS, 1 / 60, 50);
    const fast = computeFrameMotion(full, { ...DEFAULT_SETTINGS, sensitivity: 2 }, 1 / 60, 50);
    expect(fast.orbitH).toBeCloseTo(base.orbitH * 2);
    expect(fast.zoom).toBeCloseTo(base.zoom * 2);
  });

  it('produces no motion for an idle puck', () => {
    const m = computeFrameMotion(
      toDeflection(zeroRaw, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
      1 / 60,
      50
    );
    expect(m).toEqual({ panX: 0, panY: 0, zoom: 0, orbitH: 0, orbitV: 0 });
  });
});
