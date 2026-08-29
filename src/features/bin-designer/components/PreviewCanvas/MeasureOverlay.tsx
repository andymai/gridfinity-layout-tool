/**
 * DOM chrome for the 3D measuring tool: the mode switch, the live readout and
 * the exit control (#3696).
 *
 * Separate from the in-scene `MeasureTool` because this half is HTML. It also
 * keeps the readout selectable, which a troika label in the canvas is not, so a
 * number can be copied out into a slicer or a caliper log.
 *
 * Mirrors `ColorToolOverlay`'s banner deliberately: both are exclusive preview
 * tools, and reading as the same kind of thing is the point.
 */

import { Button, IconButton, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { MeasureMode } from '@/features/bin-designer/types';
import { measureBetween } from '@/features/bin-designer/utils/measure3d';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';

const MODES: readonly MeasureMode[] = ['points', 'thickness'];

export function MeasureOverlay() {
  const t = useTranslation();
  const { active, mode, points } = useDesignerStore(
    useShallow((s) => ({
      active: s.ui.measure.active,
      mode: s.ui.measure.mode,
      points: s.ui.measure.points,
    }))
  );
  const setMeasureActive = useDesignerStore((s) => s.setMeasureActive);
  const setMeasureMode = useDesignerStore((s) => s.setMeasureMode);
  const clearMeasure = useDesignerStore((s) => s.clearMeasure);

  // This banner IS the tool's chrome, including its only Clear control, so it
  // goes when the tool does. Leaving a measurement drawn with no visible way to
  // dismiss it is the trap the store avoids by clearing points on exit.
  if (!active) return null;

  // Length-checked rather than truthiness-checked: index access is typed
  // non-optional here, so `points[1] && ...` reads as always true.
  const span = points.length > 1 ? measureBetween(points[0], points[1]) : null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-accent/30 bg-surface-elevated/95 px-4 py-2 text-xs font-medium text-content shadow-lg backdrop-blur">
        <div
          role="group"
          aria-label={t('binDesigner.measure.mode')}
          className="inline-flex gap-0.5 rounded-full bg-surface-tertiary p-0.5"
        >
          {MODES.map((m) => (
            <Button
              key={m}
              type="button"
              variant="ghost"
              size="sm"
              touchTarget={false}
              onClick={() => setMeasureMode(m)}
              aria-pressed={m === mode}
              className={`px-2 py-0.5 text-label leading-none ${getSegmentClass(m === mode)}`}
            >
              {m === 'points'
                ? t('binDesigner.measure.modePoints')
                : t('binDesigner.measure.modeThickness')}
            </Button>
          ))}
        </div>

        {span ? (
          <span className="tabular-nums select-text">
            {mode === 'thickness'
              ? t('binDesigner.measure.thicknessValue', { mm: span.distance.toFixed(2) })
              : t('binDesigner.measure.distanceValue', { mm: span.distance.toFixed(2) })}
          </span>
        ) : (
          <span className="text-content-tertiary">
            {mode === 'thickness'
              ? t('binDesigner.measure.hintThickness')
              : points.length === 1
                ? t('binDesigner.measure.hintSecond')
                : t('binDesigner.measure.hintFirst')}
          </span>
        )}

        {span && mode === 'points' && (
          <span className="hidden tabular-nums text-content-tertiary select-text sm:inline">
            {t('binDesigner.measure.deltas', {
              dx: span.dx.toFixed(2),
              dy: span.dy.toFixed(2),
              dz: span.dz.toFixed(2),
            })}
          </span>
        )}

        {points.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={clearMeasure}
            className="px-1 text-label font-normal text-content-tertiary hover:text-content"
          >
            {t('binDesigner.measure.clear')}
          </Button>
        )}

        <IconButton
          variant="ghost"
          size="sm"
          touchTarget={false}
          type="button"
          onClick={() => setMeasureActive(false)}
          className="-mr-1 h-6 w-6 rounded-full text-content-tertiary hover:bg-surface-hover hover:text-content"
          aria-label={t('binDesigner.measure.exit')}
        >
          <XIcon size="sm" />
        </IconButton>
      </div>
    </div>
  );
}
