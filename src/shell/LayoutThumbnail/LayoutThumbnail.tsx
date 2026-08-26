import type { LayoutPreview, ThumbnailBin } from '@/core/types';
import { getContrastColor } from '@/shared/utils/color';

interface LayoutThumbnailProps {
  preview: LayoutPreview;
  /** Width in pixels (height auto-calculated from aspect ratio) */
  size?: number;
  className?: string;
  /** If true, show bin labels when there's enough space (default: false for backward compat) */
  showLabels?: boolean;
  /** If true, the SVG fills its container via CSS; `size` only sets label detail */
  responsive?: boolean;
}

/**
 * SVG thumbnail showing a top-down view of a layout's bins.
 * Renders bins as colored rectangles within the drawer bounds.
 * Optionally shows labels when showLabels=true and bins are large enough.
 * Build the preview from a full Layout with `computePreview` (@/core/storage).
 */
export function LayoutThumbnail({
  preview,
  size = 48,
  className = '',
  showLabels = false,
  responsive = false,
}: LayoutThumbnailProps) {
  const { drawerWidth, drawerDepth, binMap } = preview;

  // Responsive mode renders at a larger internal size for label detail; the
  // on-screen size comes from CSS.
  const baseSize = responsive ? Math.max(size, 200) : size;
  const aspectRatio = drawerDepth / drawerWidth;
  const width = baseSize;
  const height = Math.round(baseSize * aspectRatio);

  // Padding for the drawer border
  const padding = showLabels ? 2 : 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const scaleX = innerWidth / drawerWidth;
  const scaleY = innerHeight / drawerDepth;

  // Minimum bin dimensions (in pixels) to show label
  const minLabelWidth = 24;
  const minLabelHeight = 16;

  // Larger renders get proportionally larger corner rounding and bin gaps
  const large = responsive;
  const binGap = large ? 1 : 0.5;
  const binMinPx = large ? 2 : 1;

  return (
    <svg
      {...(responsive
        ? { width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' }
        : { width, height })}
      viewBox={`0 0 ${width} ${height}`}
      className={`${large ? 'rounded-lg' : 'rounded'} ${className}`}
      aria-hidden="true"
    >
      {/* Drawer background */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={large ? 4 : 2}
        className="fill-surface-secondary"
      />

      {/* Inner drawer area */}
      <rect
        x={padding}
        y={padding}
        width={innerWidth}
        height={innerHeight}
        rx={large ? 2 : 1}
        className="fill-grid-bg"
      />

      {/* Grid lines when showing labels (helps visual clarity) */}
      {showLabels && binMap && binMap.length > 0 && (
        <g opacity={0.15}>
          {Array.from({ length: drawerWidth - 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={padding + (i + 1) * scaleX}
              y1={padding}
              x2={padding + (i + 1) * scaleX}
              y2={padding + innerHeight}
              className="stroke-stroke"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: drawerDepth - 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={padding}
              y1={padding + (i + 1) * scaleY}
              x2={padding + innerWidth}
              y2={padding + (i + 1) * scaleY}
              className="stroke-stroke"
              strokeWidth={0.5}
            />
          ))}
        </g>
      )}

      {/* Bins with optional labels - flip Y axis since grid y=0 is bottom, SVG y=0 is top */}
      {binMap?.map((bin) => {
        const binX = padding + bin.x * scaleX;
        const binY = padding + innerHeight - (bin.y + bin.d) * scaleY;
        const binWidth = Math.max(bin.w * scaleX - binGap, binMinPx);
        const binHeight = Math.max(bin.d * scaleY - binGap, binMinPx);

        // Label rendering (only when showLabels is enabled)
        let labelElement = null;
        if (showLabels && bin.l) {
          labelElement = renderBinLabel(
            bin,
            binX,
            binY,
            binWidth,
            binHeight,
            minLabelWidth,
            minLabelHeight
          );
        }

        return (
          <g key={`${bin.x}-${bin.y}`}>
            <rect
              x={binX}
              y={binY}
              width={binWidth}
              height={binHeight}
              rx={large ? 1 : 0.5}
              fill={bin.c}
              opacity={0.85}
            />
            {labelElement}
          </g>
        );
      })}

      {/* Empty state - show grid pattern if no bins */}
      {(!binMap || binMap.length === 0) && (
        <g opacity={0.3}>
          {/* Vertical lines */}
          {Array.from({ length: Math.min(drawerWidth, 10) }, (_, i) => (
            <line
              key={`v${i}`}
              x1={padding + (i + 1) * scaleX}
              y1={padding}
              x2={padding + (i + 1) * scaleX}
              y2={padding + innerHeight}
              className="stroke-stroke"
              strokeWidth={0.5}
            />
          ))}
          {/* Horizontal lines */}
          {Array.from({ length: Math.min(drawerDepth, 10) }, (_, i) => (
            <line
              key={`h${i}`}
              x1={padding}
              y1={padding + (i + 1) * scaleY}
              x2={padding + innerWidth}
              y2={padding + (i + 1) * scaleY}
              className="stroke-stroke"
              strokeWidth={0.5}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/**
 * Render a bin label with smart sizing and rotation.
 */
function renderBinLabel(
  bin: ThumbnailBin,
  binX: number,
  binY: number,
  binWidth: number,
  binHeight: number,
  minLabelWidth: number,
  minLabelHeight: number
): React.ReactNode {
  const label = bin.l;
  if (!label) return null;

  const binMin = Math.min(binWidth, binHeight);

  // Smart rotation: rotate text when bin is significantly taller than wide
  const shouldRotate = bin.d > bin.w * 1.5;

  // Available dimensions for text (accounting for rotation)
  const textWidth = shouldRotate ? binHeight : binWidth;
  const textHeight = shouldRotate ? binWidth : binHeight;

  // Check if we have space for a label
  const canShowLabel = textWidth >= minLabelWidth && textHeight >= minLabelHeight;
  if (!canShowLabel) return null;

  // Font sizing logic: binPixelMin * 0.28, clamped 5-10 for thumbnails
  const maxFontSize = Math.min(Math.max(Math.round(binMin * 0.28), 5), 10);

  // Check if label fits at calculated font size
  const effectiveWidth = textWidth * 0.75;
  const neededFontSize = effectiveWidth / (label.length * 0.6);
  if (neededFontSize < 5) return null;

  const fontSize = Math.min(Math.max(Math.floor(neededFontSize), 5), maxFontSize);
  const centerX = binX + binWidth / 2;
  const centerY = binY + binHeight / 2;

  return (
    <text
      x={centerX}
      y={centerY}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fontWeight="500"
      fill={getContrastColor(bin.c)}
      opacity={0.9}
      transform={shouldRotate ? `rotate(-90 ${centerX} ${centerY})` : undefined}
      style={{ pointerEvents: 'none' }}
    >
      {truncateLabel(label, textWidth, fontSize)}
    </text>
  );
}

/**
 * Truncate label to fit within available width.
 */
function truncateLabel(label: string, availableWidth: number, fontSize: number): string {
  const charsPerPixel = 0.6 * fontSize;
  const maxChars = Math.floor((availableWidth - 4) / charsPerPixel);

  if (label.length <= maxChars) {
    return label;
  }

  if (maxChars <= 2) {
    return label.charAt(0);
  }

  return label.substring(0, maxChars - 1) + '…';
}
