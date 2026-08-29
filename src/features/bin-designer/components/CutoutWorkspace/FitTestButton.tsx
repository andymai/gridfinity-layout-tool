/**
 * "Print fit test" control for cutouts.
 *
 * Downloads a thin slice of this design's own top: every opening at its real
 * size, position and spacing, at a fraction of the bin to print. The maker
 * tries their parts in it, adjusts Clearance above, and reprints the card until
 * the fit is right — the whole bin only gets printed once.
 *
 * The dialog is deliberately answerable before anything is generated: the
 * thickness range, the material comparison and the split warning all come from
 * `fitTestPlan`, which is the same plan the worker cuts from.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system/Button';
import { Stepper } from '@/design-system';
import { ExportDialog } from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useFitTestExport, FIT_TEST_BASE_NAME } from '../../hooks/useFitTestExport';
import { estimateFromVolume, estimatePrint, formatPrintTime } from '../../utils/printEstimates';
import {
  canBuildFitTest,
  clampFitTestThicknessMm,
  defaultFitTestThicknessMm,
  estimateFitTestVolumeMm3,
  fitTestThicknessRangeMm,
  planFitTestSplit,
} from '@/shared/utils/fitTestPlan';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { hasMeshImprints } from '@/shared/generation/meshAsset';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';

/** Stepper increment for the thickness field. Matches the cutout fit fields. */
const THICKNESS_STEP = 0.5;

export function FitTestButton() {
  const t = useTranslation();
  const { isExporting, canExport, downloadCard } = useFitTestExport();

  const params = useDesignerStore((s) => s.params);
  const { printSettings, bedWidth, bedDepth } = useSettingsStore(
    useShallow((s) => ({
      printSettings: s.settings.printSettings,
      bedWidth: s.settings.defaultPrintBedSize,
      bedDepth: s.settings.defaultPrintBedDepth,
    }))
  );

  const [open, setOpen] = useState(false);
  const [thickness, setThickness] = useState<number | null>(null);
  const [fileNameConfig, setFileNameConfig] = useState<ExportFileNameConfig>({
    style: 'descriptive',
    customName: '',
    format: 'stl',
  });

  const available = canBuildFitTest(params);
  const range = useMemo(() => fitTestThicknessRangeMm(params), [params]);
  // Null until the user touches the field, so the default tracks the design as
  // cutouts are added rather than freezing at whatever it was when mounted.
  const activeThickness = clampFitTestThicknessMm(
    params,
    thickness ?? defaultFitTestThicknessMm(params)
  );

  const clampThickness = useCallback(
    (v: number) => clampFitTestThicknessMm(params, Number(v.toFixed(2))),
    [params]
  );

  // A square bed leaves the depth unset, which is how `calcMaxGridUnits` reads
  // it too.
  const bed = useMemo(
    () => ({ width: bedWidth, depth: bedDepth ?? bedWidth }),
    [bedWidth, bedDepth]
  );
  const splitPlan = useMemo(
    () => planFitTestSplit(params, bed, getSplitPlanePositionsMm),
    [params, bed]
  );

  const activeFormat: ExportFileFormat = fileNameConfig.format ?? 'stl';
  const isSplit = splitPlan.pieceCount > 1;
  const displayExtension = isSplit ? '.zip' : FORMAT_EXTENSIONS[activeFormat];
  const baseName =
    fileNameConfig.style === 'custom' && fileNameConfig.customName.trim() !== ''
      ? fileNameConfig.customName.trim()
      : FIT_TEST_BASE_NAME;

  const estimates = useMemo(() => {
    if (!available) return null;
    const bin = estimatePrint(params, printSettings);
    // Through the same conversion the bin uses, not scaled from the bin's
    // finished figure: the print time carries a flat overhead that does not
    // shrink with the part, so a ratio would under-report the card.
    const card = estimateFromVolume(
      estimateFitTestVolumeMm3(params, activeThickness),
      printSettings
    );
    return [
      {
        label: t('binDesigner.cutouts.fitTest.estimateCard'),
        value: `${card.gramsFilament.toFixed(1)} g · ${formatPrintTime(card.printTimeMinutes)}`,
      },
      {
        label: t('binDesigner.cutouts.fitTest.estimateBin'),
        value: `${bin.gramsFilament.toFixed(1)} g · ${formatPrintTime(bin.printTimeMinutes)}`,
      },
    ];
  }, [available, params, printSettings, activeThickness, t]);

  const handleDownload = useCallback(() => {
    void downloadCard({ format: activeFormat, thicknessMm: activeThickness, baseName, bed }).then(
      (succeeded) => {
        if (!succeeded) return;
        useToastStore
          .getState()
          .addToast(t('binDesigner.cutouts.fitTest.exportComplete'), 'success', 3000);
        setOpen(false);
      }
    );
  }, [downloadCard, activeFormat, activeThickness, baseName, bed, t]);

  const tips = useMemo(
    () => [
      t('binDesigner.cutouts.fitTest.tip1'),
      t('binDesigner.cutouts.fitTest.tip2'),
      t('binDesigner.cutouts.fitTest.tip3'),
    ],
    [t]
  );

  // STEP carries no mesh imprint: those pockets are subtracted after
  // tessellation, so a STEP file would be valid, plausibly sized, and missing
  // every scanned pocket. The worker refuses it; say so before they pick it.
  const formatStates = useMemo(
    () =>
      hasMeshImprints(params)
        ? { step: { disabled: true, reason: t('binDesigner.cutouts.fitTest.stepUnavailable') } }
        : undefined,
    [params, t]
  );

  const warning = useMemo(() => {
    if (splitPlan.blockedSeams > 0) {
      return { message: t('binDesigner.cutouts.fitTest.warnSeamThroughCutout') };
    }
    if (isSplit) {
      return {
        message: t('binDesigner.cutouts.fitTest.warnSplit', { count: splitPlan.pieceCount }),
      };
    }
    return null;
  }, [splitPlan.blockedSeams, splitPlan.pieceCount, isSplit, t]);

  if (!available) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => setOpen(true)}
        disabled={!canExport}
      >
        {t('binDesigner.cutouts.fitTest.button')}
      </Button>

      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        activeFormat={activeFormat}
        fileNameConfig={fileNameConfig}
        onFileNameConfigChange={setFileNameConfig}
        fileName={`${baseName}${displayExtension}`}
        displayExtension={displayExtension}
        canExport={canExport}
        isExporting={isExporting}
        onDownload={handleDownload}
        formatStates={formatStates}
        warningBanner={warning}
        estimates={estimates}
        estimatesTitle={t('binDesigner.cutouts.fitTest.estimatesTitle')}
        sectionTitle={t('binDesigner.cutouts.fitTest.dialogTitle')}
        sectionDescription={t('binDesigner.cutouts.fitTest.dialogDescription')}
        extras={
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-stroke-subtle bg-surface p-3">
              <div
                className="flex items-center justify-between gap-2"
                title={t('binDesigner.cutouts.fitTest.thicknessInfo')}
              >
                <span className="text-xs text-content-secondary">
                  {t('binDesigner.cutouts.fitTest.thickness')}
                  <span className="ml-1 text-content-tertiary">mm</span>
                </span>
                <Stepper
                  size="sm"
                  value={activeThickness}
                  onChange={(v) => setThickness(clampThickness(v))}
                  onStep={(delta) =>
                    setThickness(clampThickness(activeThickness + delta * THICKNESS_STEP))
                  }
                  min={range.min}
                  max={range.max}
                  step={THICKNESS_STEP}
                  aria-label={t('binDesigner.cutouts.fitTest.thickness')}
                />
              </div>
              <p className="mt-1.5 text-label leading-relaxed text-content-tertiary">
                {t('binDesigner.cutouts.fitTest.thicknessHint')}
              </p>
            </div>

            <div className="rounded-lg border border-stroke-subtle bg-surface p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
                {t('binDesigner.cutouts.fitTest.tipsTitle')}
              </h3>
              <ul className="space-y-1 text-xs text-content-secondary">
                {tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span aria-hidden="true" className="text-content-tertiary">
                      •
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        }
      />
    </>
  );
}
