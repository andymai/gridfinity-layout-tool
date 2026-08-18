import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCutoutSocketPlan } from './useCutoutSocketPlan';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';

const cutout = (o: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 40,
  y: 8,
  width: 25,
  depth: 18,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: 'M4',
  groupId: null,
  ...o,
});

function board(cutouts: Cutout[]) {
  const { params } = useDesignerStore.getState();
  useDesignerStore.setState({
    params: {
      ...params,
      width: 3,
      depth: 2,
      height: 4,
      style: 'solid',
      base: { ...params.base, solid: true, stackingLip: false },
      cutouts,
    },
  });
}

describe('useCutoutSocketPlan', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('is empty on a board with no socket-mode cutouts', () => {
    board([cutout()]);
    const { result } = renderHook(() => useCutoutSocketPlan());

    expect(result.current.socketCount).toBe(0);
    expect(result.current.skippedCount).toBe(0);
  });

  it('keys a planned socket by its cutout', () => {
    board([cutout({ labelMode: 'socket', textAnchor: 'top' })]);
    const { result } = renderHook(() => useCutoutSocketPlan());

    expect(result.current.socketCount).toBe(1);
    expect(result.current.byCutoutId.get('c1')?.text).toBe('M4');
  });

  it('reports a skip with its reason', () => {
    board([cutout({ labelMode: 'socket', textAnchor: 'center' })]);
    const { result } = renderHook(() => useCutoutSocketPlan());

    expect(result.current.skippedByCutoutId.get('c1')).toBe('centerAnchor');
  });

  // Socket centres are bin-centred; a consumer drawing in the editor's
  // interior-corner frame needs the box they were measured against, and must
  // not reach for a prop that may describe a different one.
  it('reports the interior it planned against', () => {
    board([cutout({ labelMode: 'socket', textAnchor: 'top' })]);
    const { result } = renderHook(() => useCutoutSocketPlan());
    const socket = result.current.byCutoutId.get('c1');

    expect(result.current.innerW).toBeGreaterThan(0);
    expect(socket).toBeDefined();
    // Interior-frame X lands back inside [0, innerW].
    const editorX = (socket?.centerX ?? 0) + result.current.innerW / 2;
    expect(editorX).toBeGreaterThan(0);
    expect(editorX).toBeLessThan(result.current.innerW);
  });
});
