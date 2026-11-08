import { useId } from 'react';
import { Button, Slider } from '@/design-system';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { useTranslation } from '@/i18n';
import { ScanToolList } from '@/shared/scanReview';
import type { SceneShape } from '@/shared/scanTrace';

interface ToolsPanelProps {
  readonly shapes: readonly SceneShape[];
  readonly units: 'mm' | 'px';
  readonly drawingRegion: boolean;
  readonly hasRegion: boolean;
  readonly sensitivity: number;
  readonly holesFound: boolean;
  readonly keepHoles: boolean;
  readonly canRefine: boolean;
  readonly canUndo: boolean;
  readonly disabled: boolean;
  readonly onDrawRegion: () => void;
  readonly onClearRegion: () => void;
  readonly onSensitivity: (value: number) => void;
  readonly onCommitSensitivity: (value: number) => void;
  readonly onKeepHoles: (keep: boolean) => void;
  readonly onRemove: (index: number) => void;
  readonly onUndo: () => void;
}

/** The segmenter's sensitivity range; 0 is its automatic threshold. */
const SENSITIVITY_MIN = -127;
const SENSITIVITY_MAX = 128;

export function ToolsPanel({
  shapes,
  units,
  drawingRegion,
  hasRegion,
  sensitivity,
  holesFound,
  keepHoles,
  canRefine,
  canUndo,
  disabled,
  onDrawRegion,
  onClearRegion,
  onSensitivity,
  onCommitSensitivity,
  onKeepHoles,
  onRemove,
  onUndo,
}: ToolsPanelProps) {
  const t = useTranslation();
  const id = useId();
  const valueText =
    sensitivity === 0 ? t('binDesigner.cutouts.traceView.sensitivityAuto') : String(sensitivity);

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-heading`} className="text-sm font-semibold text-content-primary">
          {t('binDesigner.cutouts.traceView.tools.heading')}
        </h3>
        {canUndo && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onUndo}>
            {t('scan.review.undo')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={drawingRegion ? 'primary' : 'secondary'}
            size="sm"
            disabled={disabled}
            aria-pressed={drawingRegion}
            onClick={onDrawRegion}
          >
            {t('binDesigner.cutouts.traceView.region.draw')}
          </Button>
          {hasRegion && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onClearRegion}
            >
              {t('binDesigner.cutouts.traceView.region.clear')}
            </Button>
          )}
        </div>
        <p className="text-xs text-content-tertiary">
          {t('binDesigner.cutouts.traceView.region.hint')}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span id={`${id}-sensitivity`} className="font-medium text-content-primary">
            {t('binDesigner.cutouts.traceView.sensitivity')}
          </span>
          <span className="text-content-secondary">{valueText}</span>
        </div>
        <Slider
          aria-label={t('binDesigner.cutouts.traceView.sensitivity')}
          aria-valuetext={valueText}
          min={SENSITIVITY_MIN}
          max={SENSITIVITY_MAX}
          step={1}
          value={sensitivity}
          disabled={disabled}
          onChange={onSensitivity}
          onCommit={onCommitSensitivity}
        />
        <p className="text-xs text-content-tertiary">
          {t('binDesigner.cutouts.traceView.sensitivityHint')}
        </p>
      </div>

      {holesFound && (
        <FeatureToggle
          label={t('scan.review.keepHoles')}
          info={t('scan.review.keepHolesHint')}
          checked={keepHoles}
          onChange={() => onKeepHoles(!keepHoles)}
          disabled={disabled}
        />
      )}

      {shapes.length > 0 ? (
        <ScanToolList shapes={shapes} units={units} disabled={disabled} onRemove={onRemove} />
      ) : (
        <p className="text-xs text-content-secondary">
          {t('binDesigner.cutouts.traceView.tools.none')}
        </p>
      )}

      {canRefine && (
        <p className="text-xs text-content-tertiary">
          {t('binDesigner.cutouts.traceView.tools.tapHint')}
        </p>
      )}
    </section>
  );
}
