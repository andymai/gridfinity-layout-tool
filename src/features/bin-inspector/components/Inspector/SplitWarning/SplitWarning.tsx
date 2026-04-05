import { useTranslation } from '@/i18n';

interface SplitWarningProps {
  binWidth: number;
  binDepth: number;
  maxGridUnits: { width: number; depth: number };
  gridUnitMm: number;
  printBedSize: number;
  printBedDepth: number;
  /** Compact mode shows less detail (for mobile) */
  compact?: boolean;
}

/**
 * Small visual showing how a bin compares to max print bed size.
 * Shows print bed outline with bin overlaid, scaled proportionally.
 * Supports rectangular (asymmetric) print beds.
 */
function PrintBedIndicator({
  binWidth,
  binDepth,
  maxUnits,
  gridUnitMm,
  printBedWidth,
  printBedDepth,
}: {
  binWidth: number;
  binDepth: number;
  maxUnits: { width: number; depth: number };
  gridUnitMm: number;
  printBedWidth: number;
  printBedDepth: number;
}) {
  const size = 64;
  const padding = 4;
  const innerSize = size - padding * 2;

  // Scale: fit the larger bed dimension into innerSize
  const maxBedDim = Math.max(printBedWidth, printBedDepth);
  const scale = innerSize / maxBedDim;

  // Bed dimensions scaled
  const bedW = printBedWidth * scale;
  const bedD = printBedDepth * scale;

  // Bin dimensions in mm
  const binWidthMm = binWidth * gridUnitMm;
  const binDepthMm = binDepth * gridUnitMm;

  // Max printable area
  const maxWidthMm = maxUnits.width * gridUnitMm;
  const maxDepthMm = maxUnits.depth * gridUnitMm;

  const isAsymmetric = printBedWidth !== printBedDepth;
  const bedLabel = isAsymmetric ? `${printBedWidth}×${printBedDepth}mm` : `${printBedWidth}mm`;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={`Print bed: ${printBedWidth}×${printBedDepth}mm, Max bin: ${maxUnits.width}×${maxUnits.depth} units`}
    >
      {/* Print bed outline */}
      <div
        className="absolute border-2 border-dashed border-stroke rounded-sm"
        style={{
          left: padding,
          bottom: padding,
          width: Math.min(bedW, innerSize),
          height: Math.min(bedD, innerSize),
        }}
      />

      {/* Max printable zone */}
      <div
        className="absolute bg-success/10 border border-success/30 rounded-sm"
        style={{
          left: padding,
          bottom: padding,
          width: Math.min(maxWidthMm * scale, innerSize),
          height: Math.min(maxDepthMm * scale, innerSize),
        }}
      />

      {/* Bin overlay (shows overflow) */}
      <div
        className="absolute bg-warning/30 border-2 border-warning rounded-sm"
        style={{
          left: padding,
          bottom: padding,
          width: Math.min(binWidthMm * scale, innerSize + padding),
          height: Math.min(binDepthMm * scale, innerSize + padding),
        }}
      />

      {/* Label */}
      <div className="absolute bottom-0 right-0 text-[8px] text-content-disabled px-0.5">
        {bedLabel}
      </div>
    </div>
  );
}

/**
 * Warning indicator when bin exceeds print bed size and needs splitting.
 * Shows both a visual indicator and text explanation.
 */
export function SplitWarning({
  binWidth,
  binDepth,
  maxGridUnits,
  gridUnitMm,
  printBedSize,
  printBedDepth,
  compact = false,
}: SplitWarningProps) {
  const t = useTranslation();
  const needsSplit = binWidth > maxGridUnits.width || binDepth > maxGridUnits.depth;
  const pieces =
    Math.ceil(binWidth / maxGridUnits.width) * Math.ceil(binDepth / maxGridUnits.depth);

  if (!needsSplit) {
    // Show success state - bin fits print bed
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated">
        <svg
          className="w-4 h-4 text-success flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs text-content-tertiary">
          {t('inspector.fitsPrintBedDimensions', {
            binWidth,
            binDepth,
            max: `${maxGridUnits.width}×${maxGridUnits.depth}`,
          })}
        </span>
      </div>
    );
  }

  // Warning state - bin exceeds print bed
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-warning-muted)] border border-[var(--color-warning)] text-[var(--color-warning)]">
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-sm">{t('inspector.split.piecesNeeded', { count: pieces })}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-warning-muted)] border border-[var(--color-warning)] text-[var(--color-warning)] text-sm">
      <PrintBedIndicator
        binWidth={binWidth}
        binDepth={binDepth}
        maxUnits={maxGridUnits}
        gridUnitMm={gridUnitMm}
        printBedWidth={printBedSize}
        printBedDepth={printBedDepth}
      />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="font-medium">{t('inspector.split.title')}</span>
        </div>
        <p className="text-xs opacity-80">
          {t('inspector.split.message', {
            width: binWidth,
            depth: binDepth,
            widthMm: binWidth * gridUnitMm,
            depthMm: binDepth * gridUnitMm,
            bedSize: `${printBedSize}×${printBedDepth}`,
          })}
        </p>
      </div>
    </div>
  );
}
