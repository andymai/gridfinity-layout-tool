import { describe, it, expect, vi } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { handleGroupRotateMove } from './groupRotateHandler';
import type { InteractionMode } from '../useCutoutInteraction';
import type { BinBounds, DeadZoneRef, PreviewMap } from './types';

type GroupRotatingMode = Extract<InteractionMode, { type: 'group-rotating' }>;

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c-1',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: 'g-1',
    ...overrides,
  };
}

const BOUNDS: BinBounds = { binWidth: 200, binDepth: 200 };
const PAST_DEAD_ZONE: DeadZoneRef = { current: true };

function makeMode(cutouts: readonly Cutout[], center: { x: number; y: number }): GroupRotatingMode {
  const initialStates = new Map(
    cutouts.map((c) => [c.id, { x: c.x, y: c.y, rotation: c.rotation }])
  );
  return { type: 'group-rotating', startAngle: 0, center, initialStates };
}

function capture(): { setPreview: (p: PreviewMap) => void; get preview(): PreviewMap | null } {
  let preview: PreviewMap | null = null;
  return {
    setPreview: vi.fn((p: PreviewMap) => {
      preview = p;
    }),
    get preview() {
      return preview;
    },
  };
}

describe('handleGroupRotateMove', () => {
  // A rigid rotation moves member centers around the group center and turns
  // each member by the SAME visual angle. The renderer draws a cutout at
  // `-rotation` (CutoutShapeMesh rotationZ), while positions rotate CCW — so a
  // CCW drag of θ must *decrease* each member's stored rotation by θ. Adding θ
  // instead spins every member backwards on its own axis while the constellation
  // swings forwards, which is the "each item rotates on its own axis" symptom.
  it('turns every member by the same visual angle the constellation swings', () => {
    const cutouts = [
      makeCutout({ id: 'a', x: 0, y: 0 }),
      makeCutout({ id: 'b', x: 20, y: 0, rotation: 30 }),
    ];
    const center = { x: 15, y: 5 };
    const setters = capture();

    // startAngle 0, cursor at +90° from center → delta = +90 (CCW).
    handleGroupRotateMove(
      makeMode(cutouts, center),
      { mmX: center.x, mmY: center.y + 50 },
      cutouts,
      BOUNDS,
      PAST_DEAD_ZONE,
      setters
    );

    const preview = setters.preview;
    expect(preview).not.toBeNull();
    expect(preview?.get('a')?.rotation).toBe(270);
    expect(preview?.get('b')?.rotation).toBe(300);
  });

  it('carries member centers around the group center', () => {
    const cutouts = [makeCutout({ id: 'a', x: 0, y: 0 }), makeCutout({ id: 'b', x: 20, y: 0 })];
    const center = { x: 15, y: 5 };
    const setters = capture();

    handleGroupRotateMove(
      makeMode(cutouts, center),
      { mmX: center.x, mmY: center.y + 50 },
      cutouts,
      BOUNDS,
      PAST_DEAD_ZONE,
      setters
    );

    // a's center (5,5) rotated +90° CCW about (15,5) → (15,-5); x/y are the
    // corner, so subtract half the extents.
    expect(setters.preview?.get('a')?.x).toBeCloseTo(10);
    expect(setters.preview?.get('a')?.y).toBeCloseTo(-10);
  });

  it('preserves the distance between members (rigid, not sheared)', () => {
    const cutouts = [makeCutout({ id: 'a', x: 0, y: 0 }), makeCutout({ id: 'b', x: 20, y: 40 })];
    const center = { x: 15, y: 25 };
    const setters = capture();

    handleGroupRotateMove(
      makeMode(cutouts, center),
      { mmX: center.x + 30, mmY: center.y + 30 },
      cutouts,
      BOUNDS,
      PAST_DEAD_ZONE,
      setters
    );

    const a = setters.preview?.get('a');
    const b = setters.preview?.get('b');
    const before = Math.hypot(20 - 0, 40 - 0);
    const after = Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
    expect(after).toBeCloseTo(before);
    // Both members turned by the same amount — no relative twist within the group.
    expect(a?.rotation).toBeCloseTo(b?.rotation ?? -1);
  });
});
