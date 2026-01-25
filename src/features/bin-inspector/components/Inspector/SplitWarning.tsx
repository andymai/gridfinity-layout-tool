import { useTranslation } from '@/i18n';

interface SplitWarningProps {
  binWidth: number;
  binDepth: number;
  maxGridUnits: number;
  gridUnitMm: number;
  printBedSize: number;
  /** Compact mode shows less detail (for mobile) */
  compact?: boolean;
}

/**
 * Small visual showing how a bin compares to max print bed size.
 * Shows print bed outline with bin overlaid, scaled proportionally.
 */
function PrintBedIndicator({
  binWidth,
  binDepth,
  maxUnits,
  gridUnitMm,
  printBedSize,
}: {
  binWidth: number;
  binDepth: number;
  maxUnits: number;
  gridUnitMm: number;
  printBedSize: number;
}) {
  const size = 64;
  const padding = 4;
  const innerSize = size - padding * 2;

  // Scale: print bed = full inner size
  const scale = innerSize / printBedSize;

  // Bin dimensions in mm
  const binWidthMm = binWidth * gridUnitMm;
  const binDepthMm = binDepth * gridUnitMm;

  // Max printable area
  const maxMm = maxUnits * gridUnitMm;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={`Print bed: ${printBedSize}×${printBedSize}mm, Max bin: ${maxUnits}×${maxUnits} units`}
    >
      {/* Print bed outline */}
      <div
        className="absolute border-2 border-dashed border-stroke rounded-sm"
        style={{
          left: padding,
          top: padding,
          width: innerSize,
          height: innerSize,
        }}
      />

      {/* Max printable zone */}
      <div
        className="absolute bg-success/10 border border-success/30 rounded-sm"
        style={{
          left: padding,
          bottom: padding,
          width: Math.min(maxMm * scale, innerSize),
          height: Math.min(maxMm * scale, innerSize),
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
        {printBedSize}mm
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
  compact = false,
}: SplitWarningProps) {
  const t = useTranslation();
  const needsSplit = binWidth > maxGridUnits || binDepth > maxGridUnits;
  const pieces = Math.ceil(binWidth / maxGridUnits) * Math.ceil(binDepth / maxGridUnits);

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
        <span className="text-xs text-content-tertiary">{t('inspector.fitsPrintBedDimensions', { binWidth, binDepth, max: maxGridUnits })}</span>
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
        printBedSize={printBedSize}
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
            bedSize: printBedSize,
          })}
        </p>
      </div>
    </div>
  );
}
