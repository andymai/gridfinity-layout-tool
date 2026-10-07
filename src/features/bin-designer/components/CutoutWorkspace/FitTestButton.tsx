/**
 * "Print fit test" control for cutouts.
 *
 * Downloads a thin slice of this design's own top, every opening at its real
 * size, position and spacing, or only a thin ring around each opening. The
 * maker tries their parts on it, adjusts Clearance above, and reprints until
 * the fit is right; the whole bin only gets printed once.
 *
 * The dialog is deliberately answerable before anything is generated: the
 * size ranges, the material comparison and the split warning all come from
 * `fitTestPlan` and `fitTestOutlinePlan`, the same plans the worker cuts from.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system/Button';
import { SegmentedControl, Stepper } from '@/design-system';
import { ExportDialog } from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  useFitTestExport,
  FIT_TEST_BASE_NAME,
  FIT_TEST_OUTLINE_BASE_NAME,
} from '../../hooks/useFitTestExport';
import { FIT_TEST_THICKNESS_STEP, useFitTestOptions } from '../../hooks/useFitTestOptions';
import { estimateFromVolume, estimatePrint, formatPrintTime } from '../../utils/printEstimates';
import {
  FIT_TEST_STAMP_MIN_THICKNESS_MM,
  canBuildFitTest,
  estimateFitTestVolumeMm3,
  planFitTestSplit,
} from '@/shared/utils/fitTestPlan';
import {
  FIT_TEST_OUTLINE_HEIGHT_MM,
  FIT_TEST_OUTLINE_WALL_MM,
  estimateFitTestOutlineVolumeMm3,
  planFitTestOutlineSplit,
} from '@/shared/utils/fitTestOutlinePlan';
import type { FitTestMode } from '@/shared/utils/fitTestOutlinePlan';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { hasMeshImprints } from '@/shared/generation/meshAsset';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';

interface SizeFieldProps {
  readonly label: string;
  readonly hint: string;
  readonly info?: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly onStep: (delta: number) => void;
}

function SizeField({ label, hint, info, value, min, max, step, onChange, onStep }: SizeFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2" title={info}>
        <span className="text-xs text-content-secondary">
          {label}
          <span className="ml-1 text-content-tertiary">mm</span>
        </span>
        <Stepper
          size="sm"
          value={value}
          onChange={onChange}
          onStep={onStep}
          min={min}
          max={max}
          step={step}
          aria-label={label}
        />
      </div>
      <p className="mt-1.5 text-label leading-relaxed text-content-tertiary">{hint}</p>
    </div>
  );
}

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
  const [fileNameConfig, setFileNameConfig] = useState<ExportFileNameConfig>({
    style: 'descriptive',
    customName: '',
    format: 'stl',
  });
  const options = useFitTestOptions(params);
  const { mode, setMode, thicknessMm, outline } = options;
  const isOutline = mode === 'outline';

  const available = canBuildFitTest(params);

  // A square bed leaves the depth unset, which is how `calcMaxGridUnits` reads
  // it too.
  const bed = useMemo(
    () => ({ width: bedWidth, depth: bedDepth ?? bedWidth }),
    [bedWidth, bedDepth]
  );
  const splitPlan = useMemo(
    () =>
      isOutline
        ? planFitTestOutlineSplit(params, bed, getSplitPlanePositionsMm, outline.wallMm)
        : planFitTestSplit(params, bed, getSplitPlanePositionsMm),
    [isOutline, params, bed, outline.wallMm]
  );

  const activeFormat: ExportFileFormat = fileNameConfig.format ?? 'stl';
  const isSplit = splitPlan.pieceCount > 1;
  const displayExtension = isSplit ? '.zip' : FORMAT_EXTENSIONS[activeFormat];
  const baseName =
    fileNameConfig.style === 'custom' && fileNameConfig.customName.trim() !== ''
      ? fileNameConfig.customName.trim()
      : isOutline
        ? FIT_TEST_OUTLINE_BASE_NAME
        : FIT_TEST_BASE_NAME;

  const handleModeChange = useCallback(
    (next: FitTestMode) => {
      setMode(next);
      // The outline has no solid to write STEP from, so a STEP pick from the
      // card would otherwise sit selected on a disabled option.
      if (next === 'outline' && fileNameConfig.format === 'step') {
        setFileNameConfig({ ...fileNameConfig, format: 'stl' });
      }
    },
    [setMode, fileNameConfig]
  );

  const estimates = useMemo(() => {
    if (!available) return null;
    const bin = estimatePrint(params, printSettings);
    // Through the same conversion the bin uses, not scaled from the bin's
    // finished figure: the print time carries a flat overhead that does not
    // shrink with the part, so a ratio would under-report the card.
    const card = estimateFromVolume(
      isOutline
        ? estimateFitTestOutlineVolumeMm3(params, outline)
        : estimateFitTestVolumeMm3(params, thicknessMm),
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
  }, [available, params, printSettings, isOutline, outline, thicknessMm, t]);

  const handleDownload = useCallback(() => {
    void downloadCard({ format: activeFormat, mode, thicknessMm, outline, baseName, bed }).then(
      (succeeded) => {
        if (!succeeded) return;
        useToastStore
          .getState()
          .addToast(t('binDesigner.cutouts.fitTest.exportComplete'), 'success', 3000);
        setOpen(false);
      }
    );
  }, [downloadCard, activeFormat, mode, thicknessMm, outline, baseName, bed, t]);

  const tips = useMemo(() => {
    if (isOutline) return [t('binDesigner.cutouts.fitTest.outlineTip')];
    const cardTips = [t('binDesigner.cutouts.fitTest.tip1'), t('binDesigner.cutouts.fitTest.tip2')];
    // Thinner cards go unstamped: there are too few layers over the glyphs.
    return thicknessMm >= FIT_TEST_STAMP_MIN_THICKNESS_MM
      ? [...cardTips, t('binDesigner.cutouts.fitTest.tip3')]
      : cardTips;
  }, [isOutline, thicknessMm, t]);

  // STEP carries no mesh imprint: those pockets are subtracted after
  // tessellation, so a STEP file would be valid, plausibly sized, and missing
  // every scanned pocket. The worker refuses it; say so before they pick it.
  // The outline is built in the mesh domain throughout, so it has no STEP at all.
  const formatStates = useMemo(() => {
    if (isOutline) {
      return {
        step: { disabled: true, reason: t('binDesigner.cutouts.fitTest.stepUnavailableOutline') },
      };
    }
    return hasMeshImprints(params)
      ? { step: { disabled: true, reason: t('binDesigner.cutouts.fitTest.stepUnavailable') } }
      : undefined;
  }, [isOutline, params, t]);

  const warning = useMemo(() => {
    if (splitPlan.blockedSeams > 0) {
      return {
        message: isOutline
          ? t('binDesigner.cutouts.fitTest.warnSeamThroughOutline')
          : t('binDesigner.cutouts.fitTest.warnSeamThroughCutout'),
      };
    }
    if (isSplit) {
      const count = splitPlan.pieceCount;
      return {
        message: isOutline
          ? t('binDesigner.cutouts.fitTest.warnSplitOutline', { count })
          : t('binDesigner.cutouts.fitTest.warnSplit', { count }),
      };
    }
    return null;
  }, [splitPlan.blockedSeams, splitPlan.pieceCount, isSplit, isOutline, t]);

  if (!available) return null;

  const sizeFields: ReactNode = isOutline ? (
    <>
      <SizeField
        label={t('binDesigner.cutouts.fitTest.outlineHeight')}
        hint={t('binDesigner.cutouts.fitTest.outlineHeightHint')}
        value={outline.heightMm}
        min={FIT_TEST_OUTLINE_HEIGHT_MM.min}
        max={FIT_TEST_OUTLINE_HEIGHT_MM.max}
        step={FIT_TEST_OUTLINE_HEIGHT_MM.step}
        onChange={options.setOutlineHeight}
        onStep={options.stepOutlineHeight}
      />
      <SizeField
        label={t('binDesigner.cutouts.fitTest.outlineWall')}
        hint={t('binDesigner.cutouts.fitTest.outlineWallHint')}
        value={outline.wallMm}
        min={FIT_TEST_OUTLINE_WALL_MM.min}
        max={FIT_TEST_OUTLINE_WALL_MM.max}
        step={FIT_TEST_OUTLINE_WALL_MM.step}
        onChange={options.setOutlineWall}
        onStep={options.stepOutlineWall}
      />
    </>
  ) : (
    <SizeField
      label={t('binDesigner.cutouts.fitTest.thickness')}
      hint={t('binDesigner.cutouts.fitTest.thicknessHint')}
      info={t('binDesigner.cutouts.fitTest.thicknessInfo')}
      value={thicknessMm}
      min={options.thicknessRange.min}
      max={options.thicknessRange.max}
      step={FIT_TEST_THICKNESS_STEP}
      onChange={options.setThickness}
      onStep={options.stepThickness}
    />
  );

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
        sectionDescription={
          isOutline
            ? t('binDesigner.cutouts.fitTest.dialogDescriptionOutline')
            : t('binDesigner.cutouts.fitTest.dialogDescription')
        }
        extras={
          <div className="mb-4 space-y-3">
            <div className="space-y-3 rounded-lg border border-stroke-subtle bg-surface p-3">
              <SegmentedControl
                size="sm"
                fullWidth
                value={mode}
                onChange={handleModeChange}
                aria-label={t('binDesigner.cutouts.fitTest.mode')}
                options={[
                  { value: 'card', label: t('binDesigner.cutouts.fitTest.modeCard') },
                  { value: 'outline', label: t('binDesigner.cutouts.fitTest.modeOutline') },
                ]}
              />
              {sizeFields}
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
