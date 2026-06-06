/**
 * Decides which edge fade (if any) to start on a render.
 *
 * - 'appear'   — edges showed up from nothing (first load, or the first draft
 *                tick of a new generation). Fade opacity 0 → 1.
 * - 'finalize' — the draft→final swap, with edges already on screen. Fade from
 *                a floor → 1 so the near-coincident edges never blink to black.
 * - null       — no change worth animating (draft→draft, steady final, no edges).
 */
export type EdgeFadeKind = 'appear' | 'finalize' | null;

export interface EdgeFadeInput {
  readonly prevHadEdges: boolean;
  readonly hasEdges: boolean;
  readonly prevIsDraft: boolean;
  readonly isDraft: boolean;
}

export function nextEdgeFade(input: EdgeFadeInput): EdgeFadeKind {
  const { prevHadEdges, hasEdges, prevIsDraft, isDraft } = input;
  if (!hasEdges) return null;
  if (!prevHadEdges) return 'appear';
  if (prevIsDraft && !isDraft) return 'finalize';
  return null;
}
