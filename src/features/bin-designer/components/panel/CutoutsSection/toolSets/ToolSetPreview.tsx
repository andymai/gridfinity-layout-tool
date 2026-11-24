import { DEFAULT_TOOL_SET_LABEL_MM } from '@/features/bin-designer/types';
import type { GeneratedToolSet } from '@/shared/toolSets/generateToolSet';

export interface ToolSetPreviewProps {
  readonly set: GeneratedToolSet;
}

const PAD_MM = 4;

/** A top-down drawing of a generated set: pockets, the channel and the sizes. */
export function ToolSetPreview({ set }: ToolSetPreviewProps) {
  const w = set.width + PAD_MM * 2;
  const h = set.depth + PAD_MM * 2;
  const x = (v: number) => v + PAD_MM;
  // SVG y runs down; the board's y runs up from the front.
  const y = (v: number) => h - (v + PAD_MM);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="max-h-72 w-full rounded border border-stroke-subtle bg-surface-secondary"
      aria-hidden="true"
      data-testid="tool-set-preview"
    >
      {set.cutouts.map((c) => {
        if (c.shape === 'slot') {
          return (
            <rect
              key={c.id}
              x={x(c.x)}
              y={y(c.y + c.depth)}
              width={c.width}
              height={c.depth}
              rx={Math.min(c.width, c.depth) / 2}
              className="fill-accent/15"
            />
          );
        }
        if (c.shape === 'path' && c.path) {
          return (
            <polygon
              key={c.id}
              points={c.path.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')}
              className="fill-accent/25 stroke-accent"
              strokeWidth={0.4}
            />
          );
        }
        if (c.shape === 'text') {
          return (
            <text
              key={c.id}
              x={x(c.x + c.width / 2)}
              y={y(c.y + c.depth / 2)}
              fontSize={c.textStyle?.fixedSize ?? DEFAULT_TOOL_SET_LABEL_MM}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-content"
            >
              {c.label}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}
