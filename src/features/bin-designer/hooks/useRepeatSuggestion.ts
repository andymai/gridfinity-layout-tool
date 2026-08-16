/**
 * Offers to collapse a hand-built arrangement of identical cutouts into one
 * parametric repeat.
 *
 * The offer rides the selection rather than a menu, because the behaviour it
 * redirects (duplicate, drag, duplicate, drag) leaves the copies selected. It
 * is passive and dismissible: nothing changes until the user accepts, and a
 * dismissal sticks for that exact selection so re-selecting the same shapes
 * does not re-ask.
 *
 * Both presentations (the inspector row and the canvas chip shown when the
 * dock is collapsed) consume this hook, so there is one detection, one
 * impression, and one set of events however it is displayed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { detectRepeatPattern, type RepeatDetection } from '@/shared/utils/cutoutRepeatDetect';

export interface RepeatSuggestion {
  readonly detection: RepeatDetection;
  /** Ready-to-render sentence describing what the merge will do. */
  readonly message: string;
  readonly apply: () => void;
  readonly dismiss: () => void;
}

/**
 * Identifies a selection for dedupe. Sorted so the same shapes reached in a
 * different order stay one offer rather than two.
 */
function selectionKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/**
 * Dismissals are shared across presentations rather than held per hook
 * instance: dismissing the canvas chip and then opening the dock is one user
 * saying no once, not two separate offers.
 */
const dismissedSelections = new Set<string>();

export interface RepeatMergeDeps {
  readonly mergeCutoutsIntoArray: (
    masterId: string,
    config: RepeatDetection['config'],
    absorbedIds: readonly string[]
  ) => void;
  readonly addToast: (options: { message: string; type: 'success' }) => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Perform the merge and report it. Shared by the suggestion row, the canvas
 * chip, the context menu and the shortcut so every route produces the same
 * single history entry, the same toast, and one event with an honest source.
 */
export function applyRepeatMerge(
  detection: RepeatDetection,
  deps: RepeatMergeDeps,
  source: 'suggestion' | 'context_menu' | 'shortcut'
): void {
  const count = detection.absorbedIds.length + 1;
  deps.mergeCutoutsIntoArray(detection.masterId, detection.config, detection.absorbedIds);
  trackEvent('cutout_repeat_merged', {
    source,
    mode: detection.mode,
    count,
    drift_mm: detection.maxDriftMm,
  });
  deps.addToast({ message: deps.t('toast.repeatCreated', { count }), type: 'success' });
}

export function useRepeatSuggestion(
  cutouts: readonly Cutout[],
  selection: ReadonlySet<string>,
  binWidth: number,
  binDepth: number,
  /** Which presentation is asking, so impressions record where they landed. */
  surface: 'inspector' | 'canvas',
  /**
   * False when this presentation is not on screen. Without it the hidden
   * instance still records an impression, and the accept rate is measured
   * against views that never happened.
   */
  enabled = true
): RepeatSuggestion | null {
  const t = useTranslation();
  const mergeCutoutsIntoArray = useDesignerStore((s) => s.mergeCutoutsIntoArray);
  const addToast = useToastStore((s) => s.addToast);
  const [, forceRender] = useState(0);

  const selected = useMemo(() => cutouts.filter((c) => selection.has(c.id)), [cutouts, selection]);
  const key = selectionKey(selected.map((c) => c.id));

  const detection = useMemo(
    () =>
      !enabled || dismissedSelections.has(key)
        ? null
        : detectRepeatPattern(selected, binWidth, binDepth),
    [selected, binWidth, binDepth, key, enabled]
  );

  // One impression per distinct selection, so dragging through a selection
  // does not emit an event per pointer move.
  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detection) return;
    const impression = `${key}:${detection.mode}:${surface}`;
    if (shownRef.current === impression) return;
    shownRef.current = impression;
    trackEvent('cutout_repeat_suggestion_shown', {
      mode: detection.mode,
      count: selected.length,
      drift_mm: detection.maxDriftMm,
      surface,
    });
  }, [detection, key, selected.length, surface]);

  const apply = useCallback(() => {
    if (!detection) return;
    applyRepeatMerge(detection, { mergeCutoutsIntoArray, addToast, t }, 'suggestion');
  }, [detection, mergeCutoutsIntoArray, addToast, t]);

  const dismiss = useCallback(() => {
    if (!detection) return;
    trackEvent('cutout_repeat_suggestion_dismissed', {
      mode: detection.mode,
      count: detection.absorbedIds.length + 1,
    });
    dismissedSelections.add(key);
    forceRender((n) => n + 1);
  }, [detection, key]);

  if (!detection) return null;

  const { config } = detection;
  const singleAxis = config.mode !== 'radial' && (config.rows === 1 || config.cols === 1);
  const layout =
    config.mode === 'radial'
      ? t('binDesigner.cutouts.repeat.suggestRadial', {
          count: selected.length,
          radius: config.radius,
        })
      : singleAxis
        ? // A single row or column is spaced on one axis; naming the other
          // pitch would state a number that does not affect the result.
          t('binDesigner.cutouts.repeat.suggestLine', {
            count: selected.length,
            pitch: config.rows === 1 ? config.pitchX : config.pitchY,
          })
        : t('binDesigner.cutouts.repeat.suggestGrid', {
            count: selected.length,
            cols: config.cols,
            rows: config.rows,
            pitchX: config.pitchX,
            pitchY: config.pitchY,
          });

  // The drift and colour notes are appended only when they are true, so the
  // sentence never claims a change the merge will not make.
  const notes = [
    detection.maxDriftMm > 0
      ? t('binDesigner.cutouts.repeat.suggestDrift', { drift: detection.maxDriftMm })
      : null,
    detection.colorConflict ? t('binDesigner.cutouts.repeat.suggestColor') : null,
  ].filter((n): n is string => n !== null);

  return { detection, message: [layout, ...notes].join(' '), apply, dismiss };
}
