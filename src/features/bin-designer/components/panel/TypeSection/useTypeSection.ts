/**
 * Design-wide type controls.
 *
 * The style lives on `params.textDefaults`, so one section governs every
 * caption in the design: wall text, the lid, label tabs, plates and cutout
 * labels all resolve through it. Per-surface refinements layer on top
 * elsewhere; this is the level at which a design reads as one family.
 *
 * The active preset is DERIVED from the fields rather than stored, so the chip
 * shown can never claim a look the geometry does not have.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  matchTextPreset,
  TEXT_FONT_BOLD_OF,
  TEXT_PRESETS,
  MIN_TEXT_DRAFT_DEG,
  MAX_TEXT_DRAFT_DEG,
} from '@/features/bin-designer/types';
import type {
  TextAnchor,
  TextCase,
  TextCutProfile,
  TextFontFamily,
  TextMode,
  TextPresetId,
  TextSizeMode,
  TextStyleDefaults,
} from '@/features/bin-designer/types';

/**
 * How much to grow the type when neither a heavier cut nor open tracking is
 * available. Enough to clear the threshold in one step from any size that trips
 * it, rather than leaving the user to press the button repeatedly.
 */
const STEM_FIX_GROWTH = 1.5;

/** Which move the one-click fix will make, so the button can name it. */
export type StemFixAction = 'bold' | 'tracking' | 'size';

/** Shown only while the design carries no caption of its own. */
const SPECIMEN_SAMPLE = 'M3 HEX NUTS\nDIN 934';

/** Bounds shared by the panel controls and the share/sync validators. */
export const TYPE_BOUNDS = {
  fixedSize: { min: 2, max: 40, step: 0.5 },
  tracking: { min: -0.05, max: 0.4, step: 0.01 },
  lineScale: { min: 0.3, max: 1, step: 0.05 },
  margin: { min: 0, max: 12, step: 0.5 },
  depth: { min: 0.1, max: 3, step: 0.1 },
  draftAngleDeg: { min: MIN_TEXT_DRAFT_DEG, max: MAX_TEXT_DRAFT_DEG, step: 1 },
} as const;

export function useTypeSection() {
  const t = useTranslation();
  const { textDefaults, setTextDefaults, stemWarning, surfaceText, compartmentTexts } =
    useDesignerStore(
      useShallow((s) => ({
        textDefaults: s.params.textDefaults,
        setTextDefaults: s.setTextDefaults,
        surfaceText: s.params.surfaceText,
        compartmentTexts: s.params.compartments.compartmentTexts,
        // Measured by the worker against the sizes it actually rendered; the
        // panel cannot compute it, because the binding size depends on host
        // boxes only the generator knows.
        stemWarning: s.generation.mesh?.typeStemWarning ?? null,
      }))
    );

  /**
   * The design's own words, when it has any.
   *
   * A specimen showing someone else's caption tells the user what the TYPEFACE
   * looks like but not what their bin will say, which is the question they
   * actually have. Falls back to a sample only while the design is empty, and
   * that sample carries a second line so the hierarchy is visible before anyone
   * has typed one.
   */
  const specimenText = useMemo(() => {
    const own = [
      surfaceText?.walls?.front,
      surfaceText?.walls?.back,
      surfaceText?.walls?.left,
      surfaceText?.walls?.right,
      surfaceText?.lidText,
      ...(compartmentTexts ?? []),
    ].find((text) => (text?.trim() ?? '') !== '');
    return own?.trim() ?? SPECIMEN_SAMPLE;
  }, [surfaceText, compartmentTexts]);

  const activePreset = useMemo(() => matchTextPreset(textDefaults), [textDefaults]);

  const update = useCallback(
    (partial: Partial<TextStyleDefaults>) => setTextDefaults(partial),
    [setTextDefaults]
  );

  const applyPreset = useCallback(
    (id: TextPresetId) => {
      // A preset replaces every field it names rather than patching, so
      // switching between two never strands a knob from the previous one.
      setTextDefaults(TEXT_PRESETS[id]);
    },
    [setTextDefaults]
  );

  const step = useCallback(
    (key: keyof typeof TYPE_BOUNDS, delta: number) => {
      const bounds = TYPE_BOUNDS[key];
      const current = textDefaults[key];
      const next = Math.min(bounds.max, Math.max(bounds.min, current + delta * bounds.step));
      // Steps land on the bound's own grid, so a nudge from a preset value that
      // sits between steps does not carry its offset forever.
      update({ [key]: Math.round(next / bounds.step) * bounds.step });
    },
    [textDefaults, update]
  );

  /**
   * Move the design off a stem the nozzle cannot resolve.
   *
   * Order matters and is about intent, not arithmetic. A heavier cut of the
   * same family is the least invasive fix, because it thickens the strokes
   * without moving a single caption. Opening tracking is next: it keeps the
   * size the user chose and only stops adjacent letters merging. Growing the
   * type is last, because that is the one change that can push a caption out
   * of the space it was fitted to.
   */
  const stemFixAction: StemFixAction = TEXT_FONT_BOLD_OF[textDefaults.font]
    ? 'bold'
    : !textDefaults.autoTracking
      ? 'tracking'
      : 'size';

  const fixStem = useCallback(() => {
    const bold = TEXT_FONT_BOLD_OF[textDefaults.font];
    if (bold !== undefined) {
      update({ font: bold });
      return;
    }
    if (!textDefaults.autoTracking) {
      update({ autoTracking: true });
      return;
    }
    const grown = Math.min(
      TYPE_BOUNDS.fixedSize.max,
      Math.max(textDefaults.fixedSize, textDefaults.minFontSize) * STEM_FIX_GROWTH
    );
    update({ sizeMode: 'fixed', fixedSize: grown, minFontSize: grown });
  }, [textDefaults, update]);

  return {
    t,
    state: {
      stemWarning,
      // Named so the button can say what it will do. "Fix it" leaves the user
      // to discover after the fact that their typeface changed.
      stemFixAction,
      specimenText,
      style: textDefaults,
      activePreset,
      // Through-cut ignores the picked face, so saying which face it will use
      // is more honest than leaving the picker looking effective.
      stencilSubstituted: textDefaults.mode === 'through-cut',
      isFixedSize: textDefaults.sizeMode === 'fixed',
      isDrafted: textDefaults.cutProfile === 'drafted',
    },
    handlers: {
      applyPreset,
      fixStem,
      setFont: (font: TextFontFamily) => update({ font }),
      setMode: (mode: TextMode) => update({ mode }),
      setTextCase: (textCase: TextCase) => update({ textCase }),
      setAnchor: (anchor: TextAnchor) => update({ anchor }),
      setSizeMode: (sizeMode: TextSizeMode) => update({ sizeMode }),
      setCutProfile: (cutProfile: TextCutProfile) => update({ cutProfile }),
      setSnapToScale: (snapToScale: boolean) => update({ snapToScale }),
      setUniformAcrossWalls: (uniformAcrossWalls: boolean) => update({ uniformAcrossWalls }),
      setAutoTracking: (autoTracking: boolean) => update({ autoTracking }),
      setTracking: (tracking: number) => update({ tracking }),
      step,
    },
  };
}
