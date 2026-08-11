/**
 * Plan view of the compartments a merge would produce.
 *
 * The dialog can say "9 compartments" accurately and still leave the user
 * guessing at the shape, which is exactly what they were about to check by
 * merging and looking. Drawn from the same `cells` the generator consumes, so
 * it cannot drift from the piece that gets built.
 */

import { useTranslation } from '@/i18n';
import { compartmentRects } from './compartmentRects';

export interface CompartmentPreviewProps {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly number[];
  readonly widthUnits: number;
  readonly depthUnits: number;
  readonly gapCompartmentIds: readonly number[];
  readonly compartmentTexts?: readonly string[];
}

/** Half the divider gap drawn between neighbours, in grid units. */
const WALL_INSET = 0.035;

export function CompartmentPreview({
  cols,
  rows,
  cells,
  widthUnits,
  depthUnits,
  gapCompartmentIds,
  compartmentTexts,
}: CompartmentPreviewProps) {
  const t = useTranslation();
  const rects = compartmentRects({
    cols,
    rows,
    cells,
    widthUnits,
    depthUnits,
    gapCompartmentIds,
    compartmentTexts,
  });

  if (rects.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${widthUnits} ${depthUnits}`}
      className="w-full h-auto max-h-40 rounded-md bg-surface"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t('designLinking.merge.preview.alt', {
        count: rects.length,
        width: widthUnits,
        depth: depthUnits,
      })}
    >
      {rects.map((rect) => (
        <rect
          key={rect.id}
          x={rect.x + WALL_INSET}
          y={rect.y + WALL_INSET}
          width={Math.max(0, rect.width - WALL_INSET * 2)}
          height={Math.max(0, rect.depth - WALL_INSET * 2)}
          rx={0.06}
          // `currentColor` driven by a text token, rather than fill-*/stroke-*
          // utilities: only the text tokens are guaranteed to exist for every
          // palette entry, and this stays theme-aware for free.
          className={rect.isGap ? 'text-content-tertiary' : 'text-accent'}
          fill="currentColor"
          fillOpacity={rect.isGap ? 0.08 : 0.2}
          stroke="currentColor"
          strokeOpacity={rect.isGap ? 0.5 : 0.8}
          strokeWidth={0.02}
          strokeDasharray={rect.isGap ? '0.08 0.06' : undefined}
        >
          <title>
            {rect.isGap
              ? t('designLinking.merge.preview.gapCompartment')
              : rect.label || t('designLinking.merge.preview.unlabelled')}
          </title>
        </rect>
      ))}
    </svg>
  );
}
