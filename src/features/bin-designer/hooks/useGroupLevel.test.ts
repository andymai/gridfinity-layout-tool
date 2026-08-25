import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useCutoutSelection } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { useGroupLevel } from './useGroupLevel';
import { isWithin } from '@/features/bin-designer/utils/cutoutHierarchy';

const testCutout = (id: string): Cutout => ({
  id,
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: id,
  groupId: null,
});

/** gA(a1,a2) and gB(b1,b2) and a loose hex, all wrapped in one container. */
function buildNested(): { container: string; gA: string; gB: string } {
  const { addCutout, groupCutouts } = useDesignerStore.getState();
  for (const id of ['a1', 'a2', 'b1', 'b2', 'hex']) addCutout(testCutout(id));
  groupCutouts(['a1', 'a2'], 'subtract');
  groupCutouts(['b1', 'b2'], 'union');
  groupCutouts(['a1', 'b1', 'hex']);

  const byId = cutoutsById();
  const container = byId.a1.parentGroups?.[0];
  if (container === undefined) throw new Error('container not formed');
  return { container, gA: byId.a1.groupId as string, gB: byId.b1.groupId as string };
}

function cutoutsById(): Record<string, Cutout> {
  return Object.fromEntries(useDesignerStore.getState().params.cutouts.map((c) => [c.id, c]));
}

function renderGroupLevel() {
  return renderHook(({ cutouts }: { cutouts: readonly Cutout[] }) => useGroupLevel({ cutouts }), {
    initialProps: { cutouts: useDesignerStore.getState().params.cutouts },
  });
}

describe('useGroupLevel', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useCutoutSelection.setState({ groupContext: [] });
  });

  it('groups at the level the editor is drilled into', () => {
    const { container, gA } = buildNested();
    useCutoutSelection.getState().setGroupContext([container]);
    const { result } = renderGroupLevel();

    result.current.handleGroup(['a1', 'hex']);

    const byId = cutoutsById();
    const inner = byId.hex.parentGroups?.[1];
    expect(byId.hex.parentGroups).toEqual([container, inner]);
    expect(byId.a1.parentGroups).toEqual([container, inner]);
    expect(byId.a1.groupId).toBe(gA);
  });

  it('ungroup peels one level, leaving nested groups intact', () => {
    const { container, gA, gB } = buildNested();
    const { result } = renderGroupLevel();

    result.current.handleUngroup(['a1', 'b1', 'hex']);

    const byId = cutoutsById();
    expect(byId.a1.groupId).toBe(gA);
    expect(byId.b1.groupId).toBe(gB);
    expect(byId.a1.parentGroups).toBeUndefined();
    expect(useDesignerStore.getState().params.cutoutGroupNames?.[container]).toBeUndefined();
  });

  it('ungroup falls back to leaving the boolean group once drilled down to shapes', () => {
    const { container, gA } = buildNested();
    useCutoutSelection.getState().setGroupContext([container, gA]);
    const { result } = renderGroupLevel();

    result.current.handleUngroup(['a1', 'a2']);

    const byId = cutoutsById();
    expect(byId.a1.groupId).toBeNull();
    expect(byId.a2.groupId).toBeNull();
    expect(byId.a1.parentGroups).toEqual([container]);
  });

  it('truncates a context whose group has gone away', () => {
    const { container, gA } = buildNested();
    useCutoutSelection.getState().setGroupContext([container, gA]);
    const { rerender } = renderGroupLevel();

    useDesignerStore.getState().peelGroup(gA);
    rerender({ cutouts: useDesignerStore.getState().params.cutouts });

    expect(useCutoutSelection.getState().groupContext).toEqual([container]);
  });

  it('truncates a context whose group survives at a different path', () => {
    const { container, gA } = buildNested();
    useCutoutSelection.getState().setGroupContext([container, gA]);
    const { rerender } = renderGroupLevel();

    // gA still exists, but out at the top level — so `[container, gA]` no
    // longer describes anything. Testing only "does gA exist" would keep the
    // stale path and silently no-op every arrange button.
    useDesignerStore.getState().moveUnitsIntoGroup([`group:${gA}`], null);
    rerender({ cutouts: useDesignerStore.getState().params.cutouts });

    const live = useCutoutSelection.getState().groupContext;
    expect(live).not.toEqual([container, gA]);
    const cutouts = useDesignerStore.getState().params.cutouts;
    expect(live.length === 0 || cutouts.some((c) => isWithin(c, live))).toBe(true);
  });
});
