import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { labelPaths } from '../../utils/planLabel';
import type { LabelPlan } from '../../utils/planLabel';

/** Screen pixels per millimetre, so labels of different sizes keep their proportions. */
const PREVIEW_PX_PER_MM = 4;

interface LabelPreviewProps {
  readonly plan: LabelPlan | undefined;
  readonly measurer: TypeMeasurer | null;
  readonly ariaLabel: string;
}

/**
 * The label as it prints: the outlines the PNG is filled from, black on white
 * whatever the theme, because it shows paper.
 */
export function LabelPreview({ plan, measurer, ariaLabel }: LabelPreviewProps) {
  if (!plan || !measurer) {
    return <div className="h-10 w-32 animate-pulse rounded-sm bg-surface-secondary" />;
  }
  const { widthMm: w, heightMm: h } = plan;
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      style={{ width: `${w * PREVIEW_PX_PER_MM}px` }}
      className="block h-auto max-w-full rounded-sm bg-white ring-1 ring-stroke-subtle"
    >
      <g transform="scale(1,-1)">
        {labelPaths(plan, measurer).map((path) => (
          <path
            key={path.line}
            d={path.d}
            transform={`translate(${path.x} ${path.y})`}
            fill="black"
          />
        ))}
      </g>
    </svg>
  );
}
