import { FONT, planMapView } from '@/agent/client/planMap';
import type { PlanView } from '@/agent/contract';
import { cn } from '@/design-system';

export interface AskAiDrawerMapProps {
  readonly grid: PlanView['grid'];
  readonly bins: readonly (PlanView['bins'][number] & { readonly changed?: boolean })[];
  /** Read by a screen reader in place of the drawing. */
  readonly label: string;
  readonly className?: string;
}

/**
 * A drawer seen from above, front at the bottom, as in the layout editor. A
 * bin with `changed` gets an outline, for the bins that a change set adds or
 * moves.
 */
export function AskAiDrawerMap({ grid, bins, label, className }: AskAiDrawerMapProps) {
  const map = planMapView({ grid, bins });
  return (
    <svg
      className={cn('block w-full max-h-72', className)}
      viewBox={`-2 -2 ${map.width + 4} ${map.height + 4}`}
      role="img"
      aria-label={label}
    >
      <rect
        width={map.width}
        height={map.height}
        rx={3}
        className="fill-surface-secondary stroke-stroke-subtle"
      />
      {map.columns.map((x) => (
        <line
          key={`x${x}`}
          x1={x}
          x2={x}
          y1={0}
          y2={map.height}
          className="stroke-stroke-subtle"
          strokeWidth={0.5}
        />
      ))}
      {map.rows.map((y) => (
        <line
          key={`y${y}`}
          x1={0}
          x2={map.width}
          y1={y}
          y2={y}
          className="stroke-stroke-subtle"
          strokeWidth={0.5}
        />
      ))}
      {map.bins.map((bin) => {
        const changed = bins[bin.key]?.changed === true;
        return (
          <g key={bin.key} opacity={bin.upper ? 0.75 : 1}>
            <rect
              x={bin.x + 1}
              y={bin.y + 1}
              width={bin.w - 2}
              height={bin.h - 2}
              rx={3}
              fill={bin.color}
              className={changed ? 'stroke-accent' : undefined}
              strokeWidth={changed ? 2.5 : 0}
              strokeDasharray={changed ? '4 2' : undefined}
            />
            {bin.text && (
              <text
                x={bin.x + bin.w / 2}
                y={bin.y + bin.h / 2}
                fontSize={FONT}
                fill={bin.textColor}
                stroke={bin.color}
                strokeWidth={2}
                paintOrder="stroke"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {bin.text}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
