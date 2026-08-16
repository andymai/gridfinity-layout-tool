import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { useRepeatSuggestion } from './useRepeatSuggestion';
import { useDesignerStore } from '@/features/bin-designer/store';
import { trackEvent } from '@/shared/analytics/posthog';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const BIN = 400;

function cutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'a',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

/** Three identical cutouts on a regular pitch — a detectable row. */
function row(prefix = 'p'): Cutout[] {
  return [10, 30, 50].map((x) => cutout({ id: `${prefix}${x}`, x }));
}

const render = (cutouts: Cutout[], surface: 'inspector' | 'canvas' = 'inspector', enabled = true) =>
  renderHook(() =>
    useRepeatSuggestion(cutouts, new Set(cutouts.map((c) => c.id)), BIN, BIN, surface, enabled)
  );

describe('useRepeatSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('offers a merge for a detectable pattern', () => {
    const { result } = render(row('offer'));

    expect(result.current).not.toBeNull();
    expect(result.current?.detection.mode).toBe('grid');
  });

  it('says nothing for a selection that is not a pattern', () => {
    const scattered = [
      cutout({ id: 'a' }),
      cutout({ id: 'b', x: 30 }),
      cutout({ id: 'c', x: 47, y: 23 }),
    ];

    expect(render(scattered).result.current).toBeNull();
  });

  it('records one impression per selection, not one per render', () => {
    const { rerender } = render(row('impression'));
    rerender();
    rerender();

    const shown = vi
      .mocked(trackEvent)
      .mock.calls.filter(([name]) => name === 'cutout_repeat_suggestion_shown');
    expect(shown).toHaveLength(1);
  });

  it('records no impression while the surface is not displayed', () => {
    render(row('hidden'), 'canvas', false);

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('merges into the store as a single history entry', () => {
    const cutouts = row('merge');
    for (const c of cutouts) useDesignerStore.getState().addCutout(c);
    const before = useDesignerStore.getState().history.past.length;

    const { result } = render(cutouts);
    act(() => result.current?.apply());

    const state = useDesignerStore.getState();
    expect(state.params.cutouts).toHaveLength(1);
    expect(state.params.cutouts[0].array).toBeDefined();
    expect(state.history.past.length).toBe(before + 1);
  });

  it('stays silent when the store declines the merge', () => {
    // The detection is a snapshot; the store re-checks and can refuse. A toast
    // and a `merged` event for a refusal is a phantom in both the UI and the
    // analytics.
    const cutouts = row('refused');
    for (const c of cutouts) useDesignerStore.getState().addCutout(c);
    // Lock one absorbed cutout so the store's eligibility guard declines.
    useDesignerStore.getState().lockCutouts([cutouts[2].id]);

    const { result } = render(cutouts);
    act(() => result.current?.apply());

    expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
    const merged = vi
      .mocked(trackEvent)
      .mock.calls.filter(([name]) => name === 'cutout_repeat_merged');
    expect(merged).toHaveLength(0);
  });

  it('stops offering after a dismissal, and shares that across surfaces', () => {
    const cutouts = row('dismiss');
    const first = render(cutouts, 'inspector');
    act(() => first.result.current?.dismiss());
    first.rerender();

    expect(first.result.current).toBeNull();
    // A second presentation of the same selection must not re-ask.
    expect(render(cutouts, 'canvas').result.current).toBeNull();
  });

  it('stops offering when the selection identity is stable across renders', () => {
    // The real editor holds `selection` in state, so it is the SAME Set object
    // on the render that follows a dismissal. A harness that rebuilds the Set
    // each render silently invalidates the detection memo and hides a
    // dismissal that never actually took effect.
    const cutouts = row('stable');
    const selection = new Set(cutouts.map((c) => c.id));
    const { result, rerender } = renderHook(() =>
      useRepeatSuggestion(cutouts, selection, BIN, BIN, 'inspector')
    );
    expect(result.current).not.toBeNull();

    act(() => result.current?.dismiss());
    rerender();

    expect(result.current).toBeNull();
  });

  it('still offers for a different selection after a dismissal', () => {
    act(() => render(row('x')).result.current?.dismiss());

    expect(render(row('y')).result.current).not.toBeNull();
  });

  it('names one spacing for a single row, not a pitch that does nothing', () => {
    // rows === 1, so pitchY has no effect on the result and stating it would
    // put a number in front of the user that the merge never uses.
    const message = render(row('line')).result.current?.message;

    expect(message).toContain('suggestLine');
    expect(message).not.toContain('suggestGrid');
  });

  it('names both pitches for a real grid', () => {
    const grid = [
      cutout({ id: 'g1', x: 10, y: 10 }),
      cutout({ id: 'g2', x: 30, y: 10 }),
      cutout({ id: 'g3', x: 10, y: 30 }),
      cutout({ id: 'g4', x: 30, y: 30 }),
    ];

    expect(render(grid).result.current?.message).toContain('suggestGrid');
  });

  it('mentions the drift only when something actually moves', () => {
    const exact = render(row('drift0')).result.current;
    expect(exact?.message).not.toContain('suggestDrift');

    const drifted = row('drift1');
    drifted[1] = { ...drifted[1], x: drifted[1].x + 0.3 };
    expect(render(drifted).result.current?.message).toContain('suggestDrift');
  });

  it('mentions colour only when instances disagree about it', () => {
    const uniform = row('color').map((c) => ({ ...c, color: '#ff0000' }));
    expect(render(uniform).result.current?.message).not.toContain('suggestColor');

    const mixed = [...uniform];
    mixed[2] = { ...mixed[2], color: '#00ff00' };
    expect(render(mixed).result.current?.message).toContain('suggestColor');
  });
});
