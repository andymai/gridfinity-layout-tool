import { useTranslation } from '@/i18n';
import type { SceneShape, SceneTrace } from '@/shared/scanTrace';
import { bounds } from '../../scanFlow';
import { CardStatusIcon } from './ScanCaptureGuide';

const round1 = (n: number): number => Math.round(n * 10) / 10;

function measuredFromKey(scene: SceneTrace): string {
  if (scene.reference?.kind === 'strip') return 'scan.stripMeasured';
  if (scene.reference?.kind === 'paper') return 'scan.paperMeasured';
  if (!scene.grid) return 'scan.cardMeasured';
  return scene.grid.kind === 'sheet' ? 'scan.gridMeasured' : 'scan.baseplateMeasured';
}

interface ScanScaleStatusProps {
  readonly scene: SceneTrace;
  /** The tools on screen, largest first. */
  readonly shown: readonly SceneShape[];
  readonly cardSteep: boolean;
}

/** What sized the scan and how far to trust it, or how to give it a size. */
export function ScanScaleStatus({ scene, shown, cardSteep }: ScanScaleStatusProps) {
  const t = useTranslation();
  const measured = scene.units === 'mm' && shown[0] ? bounds(shown[0].outputPoints) : null;
  return (
    <div
      className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
        measured ? 'border-success/40 bg-success/10' : 'border-warning bg-warning-muted'
      }`}
    >
      <CardStatusIcon ok={measured !== null} />
      {measured ? (
        <div className="flex flex-col gap-0.5 text-left">
          <p className="text-sm font-semibold text-content">
            {shown.length > 1
              ? t('scan.review.toolsFound', { count: shown.length })
              : t('binDesigner.cutouts.scanImport.resultSize', {
                  width: round1(measured.w),
                  depth: round1(measured.h),
                })}
          </p>
          <p className="text-xs text-success">{t(measuredFromKey(scene))}</p>
          {/* With one tool there is no list to carry the note. */}
          {shown.length === 1 && shown[0].underStrip && (
            <p className="text-xs text-warning">{t('scan.review.underStrip')}</p>
          )}
          {scene.grid && (
            <p className="text-xs text-content-secondary">
              {t(scene.grid.kind === 'sheet' ? 'scan.gridDetail' : 'scan.baseplateDetail', {
                count: scene.grid.cells.length,
                rms: round1(scene.grid.rmsMm),
              })}
            </p>
          )}
          {scene.grid?.kind === 'baseplate' && (
            <p className="text-xs text-content-tertiary">{t('scan.baseplateAccuracyHint')}</p>
          )}
          {cardSteep && <p className="text-xs text-warning">{t('scan.cardSteepAngle')}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 text-left">
          <p className="text-sm font-semibold text-warning">
            {t('binDesigner.cutouts.traceView.scale.none')}
          </p>
          <p className="text-xs text-content-secondary">{t('scan.noReferenceHint')}</p>
        </div>
      )}
    </div>
  );
}
