import type { LayoutPreview } from '@/core/types';

interface LayoutThumbnailProps {
  preview: LayoutPreview;
  /** Width in pixels (height auto-calculated from aspect ratio) */
  size?: number;
  className?: string;
}

/**
 * SVG thumbnail showing a top-down view of a layout's bins.
 * Renders bins as colored rectangles within the drawer bounds.
 */
export function LayoutThumbnail({ preview, size = 48, className = '' }: LayoutThumbnailProps) {
  const { drawerWidth, drawerDepth, binMap } = preview;

  // Calculate aspect ratio and dimensions
  const aspectRatio = drawerDepth / drawerWidth;
  const width = size;
  const height = Math.round(size * aspectRatio);

  // Padding for the drawer border
  const padding = 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const scaleX = innerWidth / drawerWidth;
  const scaleY = innerHeight / drawerDepth;

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

      {/* Bins - flip Y axis since grid y=0 is bottom, SVG y=0 is top */}
      {binMap?.map((bin) => (
        <rect
          key={`${bin.x}-${bin.y}`}
          x={padding + bin.x * scaleX}
          y={padding + innerHeight - (bin.y + bin.d) * scaleY}
          width={Math.max(bin.w * scaleX - 0.5, 1)}
          height={Math.max(bin.d * scaleY - 0.5, 1)}
          rx={0.5}
          fill={bin.c}
          opacity={0.85}
        />
      ))}

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
