import type { Layout } from '@/core/types';

interface LayoutThumbnailWithLabelsProps {
  layout: Layout;
  /** Base size for internal calculations (actual display size controlled by CSS) */
  size?: number;
  className?: string;
  /** If true, SVG fills container via CSS instead of using fixed dimensions */
  responsive?: boolean;
}

/**
 * SVG thumbnail showing a top-down view of a layout's bins with labels.
 * Enhanced version specifically for the inspiration gallery that displays
 * bin labels when space permits.
 */
export function LayoutThumbnailWithLabels({
  layout,
  size = 160,
  className = '',
  responsive = false,
}: LayoutThumbnailWithLabelsProps) {
  const { drawer, bins, categories } = layout;
  const { width: drawerWidth, depth: drawerDepth } = drawer;

  // Calculate aspect ratio and dimensions
  // Use a larger base size for responsive mode to get better label detail
  const baseSize = responsive ? 200 : size;
  const aspectRatio = drawerDepth / drawerWidth;
  const width = baseSize;
  const height = Math.round(baseSize * aspectRatio);

  // Padding for the drawer border
  const padding = 2;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const scaleX = innerWidth / drawerWidth;
  const scaleY = innerHeight / drawerDepth;

  // Build category color lookup
  const categoryColors = new Map(categories.map((c) => [c.id, c.color]));

  // Filter to non-staging bins only
  const visibleBins = bins.filter((bin) => bin.layerId !== '__staging__');

  // Minimum bin dimensions (in pixels) to show label
  const minLabelWidth = 24;
  const minLabelHeight = 16;

  return (
    <svg
      {...(responsive
        ? { width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' }
        : { width, height })}
      viewBox={`0 0 ${width} ${height}`}
      className={`rounded-lg ${className}`}
      aria-hidden="true"
    >
      {/* Drawer background */}
      <rect x={0} y={0} width={width} height={height} rx={4} className="fill-surface-secondary" />

      {/* Inner drawer area */}
      <rect
        x={padding}
        y={padding}
        width={innerWidth}
        height={innerHeight}
        rx={2}
        className="fill-grid-bg"
      />

      {/* Grid lines for visual reference */}
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

      {/* Bins with labels - flip Y axis since grid y=0 is bottom, SVG y=0 is top */}
      {visibleBins.map((bin) => {
        const binX = padding + bin.x * scaleX;
        const binY = padding + innerHeight - (bin.y + bin.depth) * scaleY;
        const binWidth = Math.max(bin.width * scaleX - 1, 2);
        const binHeight = Math.max(bin.depth * scaleY - 1, 2);
        const binMin = Math.min(binWidth, binHeight);
        const color = categoryColors.get(bin.category) || '#94a3b8';

        // Smart rotation: rotate text when bin is significantly taller than wide (matches Bin.tsx)
        const shouldRotate = bin.depth > bin.width * 1.5;

        // Available dimensions for text (accounting for rotation)
        const textWidth = shouldRotate ? binHeight : binWidth;
        const textHeight = shouldRotate ? binWidth : binHeight;

        // Determine if we have space for a label
        const hasLabel = bin.label && bin.label.trim() !== '';
        const canShowLabel = hasLabel && textWidth >= minLabelWidth && textHeight >= minLabelHeight;

        // Font sizing logic matching Bin.tsx: binPixelMin * 0.28, clamped 5-10 for thumbnails
        const maxFontSize = Math.min(Math.max(Math.round(binMin * 0.28), 5), 10);

        // Check if label fits at calculated font size
        let labelFits = false;
        let fontSize = maxFontSize;
        if (canShowLabel && bin.label) {
          const effectiveWidth = textWidth * 0.75;
          const neededFontSize = effectiveWidth / (bin.label.length * 0.6);
          if (neededFontSize >= 5) {
            labelFits = true;
            fontSize = Math.min(Math.max(Math.floor(neededFontSize), 5), maxFontSize);
          }
        }

        const showLabel = canShowLabel && labelFits;
        const centerX = binX + binWidth / 2;
        const centerY = binY + binHeight / 2;

        return (
          <g key={bin.id}>
            {/* Bin rectangle */}
            <rect
              x={binX}
              y={binY}
              width={binWidth}
              height={binHeight}
              rx={1}
              fill={color}
              opacity={0.85}
            />

            {/* Label text with rotation support */}
            {showLabel && (
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight="500"
                fill={getContrastColor(color)}
                opacity={0.9}
                transform={shouldRotate ? `rotate(-90 ${centerX} ${centerY})` : undefined}
                style={{ pointerEvents: 'none' }}
              >
                {truncateLabel(bin.label, textWidth, fontSize)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Get a contrasting text color (black or white) for a given background color.
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

/**
 * Truncate label to fit within available width.
 */
function truncateLabel(label: string, availableWidth: number, fontSize: number): string {
  // Estimate characters that fit (roughly 0.6 * fontSize per character)
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
