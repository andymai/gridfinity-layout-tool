import type { LayoutPreview, ThumbnailBin } from '@/core/types';

interface LayoutThumbnailProps {
  preview: LayoutPreview;
  /** Width in pixels (height auto-calculated from aspect ratio) */
  size?: number;
  className?: string;
  /** If true, show bin labels when there's enough space (default: false for backward compat) */
  showLabels?: boolean;
}

/**
 * SVG thumbnail showing a top-down view of a layout's bins.
 * Renders bins as colored rectangles within the drawer bounds.
 * Optionally shows labels when showLabels=true and bins are large enough.
 */
export function LayoutThumbnail({
  preview,
  size = 48,
  className = '',
  showLabels = false,
}: LayoutThumbnailProps) {
  const { drawerWidth, drawerDepth, binMap } = preview;

  // Calculate aspect ratio and dimensions
  const aspectRatio = drawerDepth / drawerWidth;
  const width = size;
  const height = Math.round(size * aspectRatio);

  // Padding for the drawer border
  const padding = showLabels ? 2 : 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const scaleX = innerWidth / drawerWidth;
  const scaleY = innerHeight / drawerDepth;

  // Minimum bin dimensions (in pixels) to show label
  const minLabelWidth = 24;
  const minLabelHeight = 16;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`rounded ${className}`}
      aria-hidden="true"
    >
      {/* Drawer background */}
      <rect x={0} y={0} width={width} height={height} rx={2} className="fill-surface-secondary" />

      {/* Inner drawer area */}
      <rect
        x={padding}
        y={padding}
        width={innerWidth}
        height={innerHeight}
        rx={1}
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
        const binWidth = Math.max(bin.w * scaleX - 0.5, 1);
        const binHeight = Math.max(bin.d * scaleY - 0.5, 1);

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
              rx={0.5}
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
 * Based on LayoutThumbnailWithLabels from inspiration-gallery.
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
 * Get a contrasting text color (black or white) for a given background color.
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
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
