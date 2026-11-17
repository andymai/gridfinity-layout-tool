import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { labelPaths } from '../../utils/planLabel';
import type { LabelPlan } from '../../utils/planLabel';

const PREVIEW_PX_PER_MM = 4;

interface LabelPreviewProps {
  readonly plan: LabelPlan | undefined;
  readonly measurer: TypeMeasurer | null;
  readonly ariaLabel: string;
}

/** Black on white in both themes: the preview shows paper. */
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
          <path key={path.line} d={path.d} transform={`translate(0 ${path.y})`} fill="black" />
        ))}
      </g>
    </svg>
  );
}
